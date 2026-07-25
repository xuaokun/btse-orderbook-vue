<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../domain/formatNumber'
import type { QuoteRow } from '../domain/orderBookView'
import {
  QuoteAnimationKind,
  type QuoteAnimation,
} from '../domain/quoteAnimation'

const props = defineProps<{
  quote: QuoteRow
  animation?: QuoteAnimation
  side: 'buy' | 'sell'
}>()

const depthWidth = computed(() => `${props.quote.depthPercentage}%`)

const isSizeAnimation = computed(
  () =>
    props.animation?.kind === QuoteAnimationKind.SizeIncrease ||
    props.animation?.kind === QuoteAnimationKind.SizeDecrease,
)
</script>

<template>
  <div class="quote-row" role="row">
    <span
      v-if="animation?.kind === QuoteAnimationKind.NewQuote"
      :key="animation.revision"
      class="quote-row__highlight"
      :class="`quote-row__highlight--${side}`"
      aria-hidden="true"
    />
    <span
      class="quote-row__cell quote-row__price"
      :class="`quote-row__price--${side}`"
      role="cell"
    >
      {{ formatNumber(quote.price, 1) }}
    </span>
    <span class="quote-row__cell quote-row__size" role="cell">
      <span
        v-if="animation && isSizeAnimation"
        :key="animation.revision"
        class="quote-row__size-highlight"
        :class="{
          'quote-row__size-highlight--increase':
            animation.kind === QuoteAnimationKind.SizeIncrease,
          'quote-row__size-highlight--decrease':
            animation.kind === QuoteAnimationKind.SizeDecrease,
        }"
        aria-hidden="true"
      />
      <span class="quote-row__size-value">
        {{ formatNumber(quote.size) }}
      </span>
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

  &__highlight,
  &__size-highlight {
    pointer-events: none;
    animation: quote-highlight 500ms ease-out forwards;
  }

  &__highlight {
    position: absolute;
    z-index: 1;
    inset: 0;

    &--buy {
      background: var(--flash-green);
    }

    &--sell {
      background: var(--flash-red);
    }
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
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    align-items: center;
  }

  &__size,
  &__total {
    justify-content: flex-end;
  }

  &__size-highlight {
    position: absolute;
    z-index: 0;
    top: 50%;
    right: 0;
    left: 0;
    height: 86%;
    transform: translateY(-50%);

    &--increase {
      background: var(--flash-green);
    }

    &--decrease {
      background: var(--flash-red);
    }
  }

  &__size-value {
    position: relative;
    z-index: 1;
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

    &__highlight,
    &__size-highlight {
      animation-duration: 0.01ms;
    }
  }
}

@keyframes quote-highlight {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
</style>
