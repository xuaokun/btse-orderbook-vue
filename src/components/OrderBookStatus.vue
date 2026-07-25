<script setup lang="ts">
import { computed } from 'vue'
import { getOrderBookDisplayStatus } from '../domain/orderBookStatus'
import {
  type OrderBookStreamError,
  SyncStatus,
} from '../types/orderbook'

const props = defineProps<{
  syncStatus: SyncStatus
  hasCachedQuotes: boolean
  streamError: OrderBookStreamError | null
}>()

const status = computed(() =>
  getOrderBookDisplayStatus({
    syncStatus: props.syncStatus,
    hasCachedQuotes: props.hasCachedQuotes,
    streamError: props.streamError,
  }),
)
</script>

<template>
  <Transition name="order-book-status">
    <div
      v-if="status"
      class="order-book-status"
      :class="`order-book-status--${status.kind}`"
      :role="status.kind === 'failed' ? 'alert' : 'status'"
      :aria-live="status.kind === 'failed' ? 'assertive' : 'polite'"
    >
      <span class="order-book-status__title">{{ status.title }}</span>
      <span v-if="status.detail" class="order-book-status__detail">
        {{ status.detail }}
      </span>
    </div>
  </Transition>
</template>

<style scoped lang="less">
.order-book-status {
  position: absolute;
  inset: 62px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text);
  background: var(--status-overlay);
  text-align: center;
  pointer-events: none;

  &--failed {
    color: var(--sell);
  }

  &__title {
    font-size: 18px;
    font-weight: 500;
  }

  &__detail {
    max-width: 360px;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.4;
  }
}

.order-book-status-enter-active,
.order-book-status-leave-active {
  transition: opacity 160ms ease;
}

.order-book-status-enter-from,
.order-book-status-leave-to {
  opacity: 0;
}
</style>
