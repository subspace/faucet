import { slackUtils, slackBuilder, TBlocks } from 'slack-utility'
import { config, log } from './config'

export const sendSlackMessage = async (message: string, blocks: TBlocks, messageIdToEdit?: string) => {
  if (config.SLACK_ENABLED) {
    try {
      if (messageIdToEdit) {
        const slackMsg = await slackUtils.slackUpdateMessage(
          config.SLACK_TOKEN,
          config.SLACK_CONVERSATION_ID,
          message,
          messageIdToEdit,
          blocks,
          false,
          false,
          false,
        )
        return slackMsg.ts ?? undefined
      } else {
        const slackMsg = await slackUtils.slackPostMessage(
          config.SLACK_TOKEN,
          config.SLACK_CONVERSATION_ID,
          message,
          blocks,
          false,
          false,
          false,
        )
        return slackMsg.resultPostMessage.ts ?? undefined
      }
    } catch (e) {
      log('Error sending slack message', e)
    }
  }
}

export const buildSlackStatsMessage = (type: 'weekRecap' | 'update', requestCount: number): TBlocks => {
  const blocks = [slackBuilder.buildSimpleSlackHeaderMsg('Faucet stats')]
  switch (type) {
    case 'weekRecap':
      blocks.push(slackBuilder.buildSimpleSectionMsg(`Last week total requests: ${requestCount} :subspace-hype:`))
      return blocks
    case 'update':
      blocks.push(
        slackBuilder.buildSimpleSectionMsg(
          `Current total requests: ${requestCount} ${requestCount > 100 ? ':subspace-hype:' : ':subheart-black:'}`,
        ),
      )
      return blocks
  }
}

export const faucetBalanceLowSlackMessage = async (balance: string) => {
  const blocks = [
    slackBuilder.buildSimpleSlackHeaderMsg('Faucet balance is low'),
    slackBuilder.buildSimpleSectionMsg(
      `The faucet balance is ${balance} ${config.TOKEN_SYMBOL}, please refill the faucet.`,
    ),
  ]
  await sendSlackMessage('Faucet balance low', blocks)
}