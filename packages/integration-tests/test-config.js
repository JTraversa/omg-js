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
limitations under the License. */

require('dotenv').config()

const config = {
  eth_node: process.env.ETH_NODE,
  watcher_url: process.env.WATCHER_URL,
  watcher_proxy_url: process.env.WATCHER_PROXY_URL,
  childchain_url: process.env.CHILDCHAIN_URL,
  plasmaframework_contract_address: process.env.PLASMAFRAMEWORK_CONTRACT_ADDRESS,
  erc20_contract_address: process.env.ERC20_CONTRACT_ADDRESS,
  fund_account: process.env.FUND_ACCOUNT,
  fund_account_private_key: process.env.FUND_ACCOUNT_PRIVATEKEY,
  fund_account_password: process.env.FUND_ACCOUNT_PASSWORD,
  test_faucet_address: process.env.TEST_FAUCET_ADDRESS,
  test_faucet_private_key: process.env.TEST_FAUCET_PRIVATEKEY,
  test_min_eth: process.env.TEST_MIN_ETH,
  test_min_erc20: process.env.TEST_MIN_ERC20
}

module.exports = config
