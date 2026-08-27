import type { Context } from 'grammy'
import { log } from '../../lib/logger.js'
import { deactivateChannelsByChatId } from '../../reaction/auto-reaction.service.js'
import { processChannelPostAutoReactions } from '../../reaction/auto-reaction.processor.js'
import { deactivateAutoChannelViewChannelsByChatId } from '../../channel-views/auto-channel-views.service.js'
import { processChannelPostAutoViews } from '../../channel-views/auto-channel-views.processor.js'
import { deactivateAdminSystemChannelsByChatId } from '../../admin/admin-system-channels.service.js'

function isSkippableChannelPost(ctx: Context): boolean {
  const post = ctx.channelPost
  if (!post) return true

  if (
    post.new_chat_title ||
    post.new_chat_photo ||
    post.delete_chat_photo ||
    post.pinned_message ||
    post.group_chat_created ||
    post.channel_chat_created ||
    post.message_auto_delete_timer_changed ||
    post.migrate_to_chat_id ||
    post.migrate_from_chat_id
  ) {
    return true
  }

  return false
}

export async function handleChannelPost(ctx: Context): Promise<void> {
  const chat = ctx.chat
  const post = ctx.channelPost

  if (!chat || chat.type !== 'channel' || !post) {
    return
  }

  if (isSkippableChannelPost(ctx)) {
    return
  }

  const payload = {
    chatId: chat.id,
    messageId: post.message_id,
    username: chat.username,
    title: chat.title,
  }

  void processChannelPostAutoReactions(payload).catch((error) => {
    log.error('AUTO_REACTION', 'channel_post handler failed', {
      chatId: chat.id,
      messageId: post.message_id,
      error: error instanceof Error ? error.message : 'unknown',
    })
  })

  void processChannelPostAutoViews(payload).catch((error) => {
    log.error('AUTO_CHANNEL_VIEWS', 'channel_post handler failed', {
      chatId: chat.id,
      messageId: post.message_id,
      error: error instanceof Error ? error.message : 'unknown',
    })
  })
}

export async function handleMyChatMember(ctx: Context): Promise<void> {
  const update = ctx.myChatMember
  if (!update) return

  const chat = update.chat
  if (chat.type !== 'channel') return

  const status = update.new_chat_member.status
  if (status === 'left' || status === 'kicked' || status === 'restricted' || status === 'member') {
    await deactivateChannelsByChatId(chat.id)
    await deactivateAutoChannelViewChannelsByChatId(chat.id)
    await deactivateAdminSystemChannelsByChatId(chat.id)
    log.info('AUTO_CHANNEL', 'channel deactivated after bot status change', {
      chatId: chat.id,
      status,
    })
  }
}
