<script setup lang="ts">
import type { QuoteRow as QuoteRowData } from '../domain/orderBookView'
import QuoteRow from './QuoteRow.vue'

defineProps<{
  rows: QuoteRowData[]
  side: 'buy' | 'sell'
  showHeader?: boolean
}>()
</script>

<template>
  <section
    class="quote-table"
    :class="`quote-table--${side}`"
    :aria-label="side === 'buy' ? 'Buy quotes' : 'Sell quotes'"
    role="table"
  >
    <div v-if="showHeader" class="quote-table__header" role="row">
      <span role="columnheader">Price (USD)</span>
      <span role="columnheader">Size</span>
      <span role="columnheader">Total</span>
    </div>

    <div class="quote-table__body" role="rowgroup">
      <QuoteRow
        v-for="quote in rows"
        :key="quote.price"
        :quote="quote"
        :side="side"
      />
    </div>
  </section>
</template>

<style scoped lang="less">
.quote-table {
  &--buy {
    padding-bottom: 12px;
  }

  &__header {
    height: 56px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    column-gap: 12px;
    padding: 0 20px;
    color: var(--text-muted);
    font-size: 23px;
    font-weight: 400;

    > :not(:first-child) {
      text-align: right;
    }

    @media (max-width: 520px) {
      font-size: clamp(16px, 5vw, 23px);
    }
  }
}
</style>
