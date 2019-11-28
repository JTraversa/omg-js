const Joi = require('@hapi/joi')
const { validateAddress, validateTxOption, validateBn } = require('./helpers')

const approveTokenSchema = Joi.object({
  erc20Address: validateAddress.required(),
  txOptions: validateTxOption.required(),
  amount: [Joi.number(), validateBn]
})

module.exports = {
  approveTokenSchema
}
