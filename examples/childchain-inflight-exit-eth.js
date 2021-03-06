/*
  Copyright 2019 OmiseGO Pte Ltd
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const BigNumber = require('bn.js')
const Web3 = require('web3')
const RootChain = require('../packages/omg-js-rootchain/src/rootchain')
const ChildChain = require('../packages/omg-js-childchain/src/childchain')
const { transaction, hexPrefix, waitForRootchainTransaction } = require('../packages/omg-js-util/src')

const config = require('./config.js')
const wait = require('./wait.js')

const web3 = new Web3(new Web3.providers.HttpProvider(config.eth_node), null, { transactionConfirmationBlocks: 1 })
const rootChain = new RootChain({ web3, plasmaContractAddress: config.plasmaframework_contract_address })
const rootChainPlasmaContractAddress = config.plasmaframework_contract_address

const childChain = new ChildChain({ watcherUrl: config.watcher_url, watcherProxyUrl: config.watcher_proxy_url, plasmaContractAddress: config.plasmaframework_contract_address })

const aliceAddress = config.alice_eth_address
const alicePrivateKey = config.alice_eth_address_private_key
const bobAddress = config.bob_eth_address
const bobPrivateKey = config.bob_eth_address_private_key

async function logBalances () {
  const aliceRootchainBalance = await web3.eth.getBalance(aliceAddress)
  const bobRootchainBalance = await web3.eth.getBalance(bobAddress)

  const alicesBalanceArray = await childChain.getBalance(aliceAddress)
  const alicesEthObject = alicesBalanceArray.find(i => i.currency === transaction.ETH_CURRENCY)
  const alicesChildchainETHBalance = alicesEthObject
    ? `${web3.utils.fromWei(String(alicesEthObject.amount))} ETH`
    : '0 ETH'

  const bobsBalanceArray = await childChain.getBalance(bobAddress)
  const bobsEthObject = bobsBalanceArray.find(i => i.currency === transaction.ETH_CURRENCY)
  const bobsChildchainETHBalance = bobsEthObject
    ? `${web3.utils.fromWei(String(bobsEthObject.amount))} ETH`
    : '0 ETH'

  console.log(`Alice's rootchain ETH balance: ${web3.utils.fromWei(String(aliceRootchainBalance), 'ether')} ETH`)
  console.log(`Bob's rootchain ETH balance: ${web3.utils.fromWei(String(bobRootchainBalance), 'ether')} ETH`)
  console.log(`Alice's childchain ETH balance: ${alicesChildchainETHBalance}`)
  console.log(`Bob's childchain ETH balance: ${bobsChildchainETHBalance}`)
}

async function childchainInflightExitEth () {
  const bobRootchainBalance = await web3.eth.getBalance(bobAddress)
  const bobsEtherBalance = web3.utils.fromWei(String(bobRootchainBalance), 'ether')
  if (bobsEtherBalance < 0.001) {
    console.log('Bob doesnt have enough ETH on the rootchain to start an exit')
    return
  }

  await logBalances()
  console.log('-----')

  const transferAmount = new BigNumber(web3.utils.toWei(config.alice_eth_transfer_amount, 'ether'))

  const payments = [{
    owner: bobAddress,
    currency: transaction.ETH_CURRENCY,
    amount: Number(transferAmount)
  }]
  const fee = {
    currency: transaction.ETH_CURRENCY
  }
  const createdTxn = await childChain.createTransaction({
    owner: aliceAddress,
    payments,
    fee
  })
  console.log(`Created a childchain transaction of ${web3.utils.fromWei(payments[0].amount.toString(), 'ether')} ETH from Alice to Bob.`)

  // type/sign/build/submit
  const typedData = transaction.getTypedData(createdTxn.transactions[0], rootChainPlasmaContractAddress)
  const signatures = childChain.signTransaction(typedData, [alicePrivateKey])
  const signedTxn = childChain.buildSignedTransaction(typedData, signatures)
  console.log('Transaction created but not submitted')

  // Bob hasn't seen the transaction get put into a block and he wants to exit his output.
  // check if queue exists for this token
  const hasToken = await rootChain.hasToken(transaction.ETH_CURRENCY)
  if (!hasToken) {
    console.log(`Adding a ${transaction.ETH_CURRENCY} exit queue`)
    await rootChain.addToken({
      token: transaction.ETH_CURRENCY,
      txOptions: { from: bobAddress, privateKey: bobPrivateKey }
    })
  }

  // start an in-flight exit
  const exitData = await childChain.inFlightExitGetData(hexPrefix(signedTxn))
  const exitReceipt = await rootChain.startInFlightExit({
    inFlightTx: exitData.in_flight_tx,
    inputTxs: exitData.input_txs,
    inputUtxosPos: exitData.input_utxos_pos,
    inputTxsInclusionProofs: exitData.input_txs_inclusion_proofs,
    inFlightTxSigs: exitData.in_flight_tx_sigs,
    txOptions: {
      privateKey: bobPrivateKey,
      from: bobAddress,
      gas: 6000000
    }
  })
  console.log('Bob starts an inflight exit: ', exitReceipt.transactionHash)

  const exitId = await rootChain.getInFlightExitId({ txBytes: exitData.in_flight_tx })
  console.log('Exit id: ', exitId)

  // Decode the transaction to get the index of Bob's output
  const outputIndex = createdTxn.transactions[0].outputs.findIndex(
    e => e.owner.toLowerCase() === bobAddress.toLowerCase()
  )

  // Bob needs to piggyback his output on the in-flight exit
  await rootChain.piggybackInFlightExitOnOutput({
    inFlightTx: exitData.in_flight_tx,
    outputIndex: outputIndex,
    txOptions: {
      privateKey: bobPrivateKey,
      from: bobAddress
    }
  })
  console.log('Bob piggybacks his output')

  // wait for challenge period to complete
  await wait.waitForChallengePeriodToEnd(rootChain)

  // call processExits() after challenge period is over
  const processExitsPostChallengeReceipt = await rootChain.processExits({
    token: transaction.ETH_CURRENCY,
    exitId: 0,
    maxExitsToProcess: 20,
    txOptions: { privateKey: bobPrivateKey, from: bobAddress }
  })

  await waitForRootchainTransaction({
    web3,
    transactionHash: processExitsPostChallengeReceipt.transactionHash,
    checkIntervalMs: config.millis_to_wait_for_next_block,
    blocksToWait: config.blocks_to_wait_for_txn,
    onCountdown: (remaining) => console.log(`${remaining} blocks remaining before confirmation`)
  })
  console.log('Exits processed')

  console.log('-----')
  await logBalances()
}

childchainInflightExitEth()
