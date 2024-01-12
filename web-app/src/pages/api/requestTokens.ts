import { JsonFragment } from '@ethersproject/abi'
import { Contract, Wallet, providers } from 'ethers'
import { Client, FaunaHttpErrorResponseContent, query as faunaQuery } from 'faunadb'
import { NextApiRequest, NextApiResponse } from 'next'
import { contracts } from '../../constants/contracts'
import { networks } from '../../constants/networks'
import { createStats, findStats, updateStats } from '../../utils'

type AccountType = 'github' | 'discord' | 'auto'

const faunaDbClient = new Client({
  secret: process.env.FAUNA_DB_SECRET || '',
  keepAlive: false,
  queryTimeout: 2000,
  timeout: 30,
  http2SessionIdleTime: 1000,
  domain: 'db.us.fauna.com',
  scheme: 'https'
})

export const findRequest = async (accountType: AccountType, accountId: string, requestedAt: string) => {
  return await faunaDbClient
    .query(
      faunaQuery.Paginate(
        faunaQuery.Match(
          faunaQuery.Index('requestTokens_by_accountWithTimestamp'),
          accountType + '-' + accountId + '-' + requestedAt
        )
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((response: any) => {
      if (response.data.length === 0) return false
      return true
    })
    .catch((error: FaunaHttpErrorResponseContent) => {
      console.log('error', error)
    })
}

export const saveRequest = async (
  address: string,
  accountType: AccountType,
  accountId: string,
  requestedAt: string,
  txHash: string
) => {
  await faunaDbClient
    .query(
      faunaQuery.Create(faunaQuery.Ref('classes/requestTokens'), {
        data: {
          address,
          account: accountType + '-' + accountId,
          accountType,
          accountId,
          accountWithTimestamp: accountType + '-' + accountId + '-' + requestedAt,
          txHash,
          requestedAt,
          createdAt: faunaQuery.Now()
        }
      })
    )
    .catch((error: FaunaHttpErrorResponseContent) => {
      console.log('error', error)
    })
}

const incrementFaucetRequestsCount = async (address: string, accountType: AccountType, requestDate: string) => {
  const stats = await findStats(requestDate)
  console.log('stats', stats)
  if (!stats || stats === null || stats.length === 0) {
    await createStats(address, accountType, requestDate)
  } else {
    const statsFound = stats[0].data
    await updateStats(stats[0].ref, accountType, statsFound, address)
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const CURRENT_TIME = new Date()
  // Keeping only the date and minutes to avoid spamming the faucet (reduce the number of digit to reduce time between requests)
  const REQUEST_DATE = CURRENT_TIME.toISOString().slice(0, 16) // Minutes precision
  const STATS_DATE = CURRENT_TIME.toISOString().slice(0, 10) // Daily precision

  if (!process.env.PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY env var')
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  try {
    const { chainId, address, accountType, accountId } = req.body as {
      chainId: number
      address: string
      accountType: AccountType
      accountId: string
    }

    const rpc = networks.find((network) => network.id === chainId)?.rpcUrls?.default?.http[0]
    if (!rpc) throw new Error('Unknown chainId')

    const provider = new providers.JsonRpcProvider(rpc)
    const minterWallet = new Wallet(PRIVATE_KEY, provider)
    const faucetContract = contracts.find((contract) => contract.chainId === chainId && contract.name === 'Faucet')
    if (!faucetContract) throw new Error('Unknown faucet contract')

    const previousRequestFound = await findRequest(accountType, accountId, REQUEST_DATE)
    if (!previousRequestFound) {
      const faucetAbi = faucetContract.abi as unknown as JsonFragment[]
      const faucet = new Contract(faucetContract.address, faucetAbi, minterWallet)

      const tx = await faucet.populateTransaction.requestTokens(address)
      const txResponse = await minterWallet.sendTransaction(tx)
      await saveRequest(address, accountType, accountId, REQUEST_DATE, txResponse.hash)
      await incrementFaucetRequestsCount(address, accountType, STATS_DATE)
      res.status(200).json({
        message: 'Success',
        txResponse
      })
    } else {
      res.status(200).json({
        message: 'Success',
        txResponse: null
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error requesting token', error)
    res.setHeader('Access-Control-Allow-Origin', [
      'https://subspace.network',
      'https://subspacefaucet.com',
      'https://subspace.tools/'
    ])
    res.status(400).json({
      message: 'Error',
      error: JSON.stringify(error)
    })
  }
}

export default handler
