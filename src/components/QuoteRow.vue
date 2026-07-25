<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../domain/formatNumber'
import type { QuoteRow } from '../domain/orderBookView'

const props = defineProps<{
  quote: QuoteRow
  side: 'buy' | 'sell'
}>()

const depthWidth = computed(() => `${props.quote.depthPercentage}%`)
</script>

<template>
  <div class="quote-row" role="row">
    <span
      class="quote-row__cell quote-row__price"
      :class="`quote-row__price--${side}`"
      role="cell"
    >
      {{ formatNumber(quote.price, 1) }}
    </span>
    <span class="quote-row__cell" role="cell">
      {{ formatNumber(quote.size) }}
    </span>
    <span class="quote-row__cell quote-row__total" role="cell">
      <span
        class="quote-row__depth"
        :class="`quote-row__depth--${side}`"
        :style="{ width: depthWidth }"
        aria-hidden="true"
      />
      <span class="quote-row__total-value">
        {{ formatNumber(quote.cumulativeTotal) }}
      </span>
    </span>
  </div>
</template>

<style scoped lang="less">
.quote-row {
  position: relative;
  height: 42px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  column-gap: 12px;
  padding: 0 20px;
  overflow: hidden;
  color: var(--text);
  font-size: 25px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: background-color 120ms ease;

  &:hover {
    background: var(--hover);
  }

  &__depth {
    position: absolute;
    z-index: 0;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    pointer-events: none;
    height: 86%;

    &--buy {
      background: var(--buy-bar);
    }

    &--sell {
      background: var(--sell-bar);
    }
  }

  &__cell {
    height: 100%;
    display: flex;
    align-items: center;

    &:not(:first-of-type) {
      justify-content: flex-end;
    }
  }

  &__price {
    &--buy {
      color: var(--buy);
    }

    &--sell {
      color: var(--sell);
    }
  }

  &__total {
    position: relative;
  }

  &__total-value {
    position: relative;
    z-index: 1;
  }

  @media (max-width: 520px) {
    font-size: clamp(17px, 5.4vw, 25px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0.01ms;
  }
}
</style>
