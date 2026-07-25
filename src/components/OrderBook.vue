<script setup lang="ts">
import { computed } from 'vue'
import { useLastPrice } from '../composables/useLastPrice'
import { useOrderBook } from '../composables/useOrderBook'
import { buildVisibleOrderBook } from '../domain/orderBookView'
import LastPrice from './LastPrice.vue'
import QuoteTable from './QuoteTable.vue'

const {
  state: orderBookState,
  animations: orderBookAnimations,
} = useOrderBook()
const { state: lastPriceState } = useLastPrice()

const visibleOrderBook = computed(() =>
  buildVisibleOrderBook(orderBookState.bids, orderBookState.asks),
)
</script>

<template>
  <main class="order-book" aria-labelledby="order-book-title">
    <header class="order-book__title">
      <h1 id="order-book-title">Order Book</h1>
    </header>

    <QuoteTable
      :rows="visibleOrderBook.asks"
      :animations="orderBookAnimations.asks"
      side="sell"
      show-header
    />

    <LastPrice
      :price="lastPriceState.currentPrice"
      :direction="lastPriceState.direction"
    />

    <QuoteTable
      :rows="visibleOrderBook.bids"
      :animations="orderBookAnimations.bids"
      side="buy"
    />
  </main>
</template>

<style scoped lang="less">
.order-book {
  width: min(466px, 100%);
  overflow: hidden;
  border-radius: 5px;
  background: var(--surface);
  box-shadow: 0 18px 50px var(--order-book-shadow);

  &__title {
    height: 62px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid var(--surface-divider);

    h1 {
      margin: 0;
      color: var(--text);
      font-size: 29px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.2px;
    }
  }

  @media (max-width: 520px) {
    width: 100%;
    min-height: 100vh;
    border-radius: 0;
  }
}
</style>
