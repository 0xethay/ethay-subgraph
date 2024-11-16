import { BigInt, Address } from '@graphprotocol/graph-ts'
import {
  ProductCreated,
  ProductPurchased,
  PurchaseConfirmed,
  DisputeRaised,
  DisputeResolved,
  JudgeRegistered,
  ReferralRewardEarned,
} from '../generated/Contract/Contract'
import {
  Product,
  Purchase,
  User,
  Judge,
  Transaction,
} from '../generated/schema'

// Helper function to create transaction
function createTransaction(
  txHash: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  purchaseId: string,
  type: string,
  from: string
): void {
  let transaction = new Transaction(txHash)
  transaction.timestamp = timestamp
  transaction.blockNumber = blockNumber
  transaction.purchase = purchaseId
  transaction.type = type
  transaction.from = from

  transaction.save()
}

export function handleProductCreated(event: ProductCreated): void {
  let product = new Product(event.params.id.toString())
  product.name = event.params.name
  product.price = event.params.price
  product.quantity = event.params.quantity
  product.isForSale = true
  product.seller = event.params.seller.toHexString()
  product.usdtBalance = BigInt.fromI32(0)
  product.ipfsLink = event.params.ipfsLink
  product.description = event.params.description
  product.save()

  let user = User.load(event.params.seller.toHexString())
  if (user == null) {
    user = new User(event.params.seller.toHexString())
    user.isSeller = true
    user.isJudge = false
    user.referralRewards = BigInt.fromI32(0)
    user.save()
  }
}

export function handleProductPurchased(event: ProductPurchased): void {
  let purchaseId =
    event.params.id.toString() + '-' + event.params.purchaseId.toString()
  let purchase = new Purchase(purchaseId)
  purchase.product = event.params.id.toString()
  purchase.buyer = event.params.buyer.toHexString()
  purchase.quantity = event.params.quantity
  purchase.totalPrice = event.params.totalPrice
  purchase.isConfirmed = false
  purchase.purchaseTime = event.block.timestamp
  purchase.isDisputed = false
  purchase.referrer = event.params.referrer.toHexString()
  purchase.save()

  let user = User.load(event.params.buyer.toHexString())
  if (user == null) {
    user = new User(event.params.buyer.toHexString())
    user.isSeller = false
    user.isJudge = false
    user.referralRewards = BigInt.fromI32(0)
    user.save()
  }

  // Create transaction
  createTransaction(
    event.transaction.hash.toHexString(),
    event.block.timestamp,
    event.block.number,
    purchaseId,
    'PURCHASE',
    event.params.buyer.toHexString()
  )
}

export function handlePurchaseConfirmed(event: PurchaseConfirmed): void {
  let purchaseId =
    event.params.productId.toString() + '-' + event.params.purchaseId.toString()
  let purchase = Purchase.load(purchaseId)
  if (purchase != null) {
    purchase.isConfirmed = true
    purchase.save()

    // Create transaction
    createTransaction(
      event.transaction.hash.toHexString(),
      event.block.timestamp,
      event.block.number,
      purchaseId,
      'CONFIRM',
      purchase.buyer
    )
  }
}

export function handleDisputeRaised(event: DisputeRaised): void {
  let purchaseId =
    event.params.productId.toString() + '-' + event.params.purchaseId.toString()
  let purchase = Purchase.load(purchaseId)
  if (purchase != null) {
    purchase.isDisputed = true
    purchase.judge = event.params.judge.toHexString()
    purchase.save()

    // Create transaction record for dispute
    createTransaction(
      event.transaction.hash.toHexString(),
      event.block.timestamp,
      event.block.number,
      purchaseId,
      'DISPUTE',
      purchase.buyer
    )
  }
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let purchaseId =
    event.params.productId.toString() + '-' + event.params.purchaseId.toString()
  let purchase = Purchase.load(purchaseId)
  if (purchase != null) {
    purchase.isDisputed = false
    purchase.isConfirmed = true
    purchase.save()

    // Create transaction
    createTransaction(
      event.transaction.hash.toHexString(),
      event.block.timestamp,
      event.block.number,
      purchaseId,
      'RESOLVE',
      purchase.judge!
    )
  }
}

export function handleJudgeRegistered(event: JudgeRegistered): void {
  let userId = event.params.judge.toHexString()
  let user = User.load(userId)
  if (user == null) {
    user = new User(userId)
    user.isSeller = false
    user.referralRewards = BigInt.fromI32(0)
  }
  user.isJudge = true
  user.save()

  let judge = new Judge(userId)
  judge.user = userId
  judge.save()
}

export function handleReferralRewardEarned(event: ReferralRewardEarned): void {
  let userId = event.params.referrer.toHexString()
  let user = User.load(userId)
  if (user == null) {
    user = new User(userId)
    user.isSeller = false
    user.isJudge = false
    user.referralRewards = BigInt.fromI32(0)
  }
  user.referralRewards = user.referralRewards.plus(event.params.amount)
  user.save()
}
