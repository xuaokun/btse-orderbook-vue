<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowDown,
  faArrowUp,
} from '@fortawesome/free-solid-svg-icons'
import { formatNumber } from '../domain/formatNumber'
import { LastPriceDirection } from '../types/lastPrice'

const props = defineProps<{
  price: number | null
  direction: LastPriceDirection
}>()

const directionIcon = computed(() =>
  props.direction === LastPriceDirection.Down ? faArrowDown : faArrowUp,
)
</script>

<template>
  <div
    class="last-price"
    :class="`last-price--${direction}`"
    aria-live="polite"
  >
    <template v-if="price !== null">
      <span>{{ formatNumber(price, 1) }}</span>
      <FontAwesomeIcon
        v-if="direction !== LastPriceDirection.Same"
        class="last-price__icon"
        :icon="directionIcon"
        aria-hidden="true"
      />
    </template>
    <span v-else>--</span>
  </div>
</template>

<style scoped lang="less">
.last-price {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text);
  background: var(--neutral-bar);
  font-size: 33px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;

  &--up {
    color: var(--buy);
    background: var(--buy-bar);
  }

  &--down {
    color: var(--sell);
    background: var(--sell-bar);
  }

  &__icon {
    width: 22px;
    height: 22px;
  }
}
</style>
