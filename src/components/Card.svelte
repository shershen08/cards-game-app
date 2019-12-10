<div class="scene scene--card">
  <div class="card" on:click={wrapCard} class:flipped="{front}">
    <div class="card__face card__face--front"><img src={symbol} alt={symbol}></div>
    <div class="card__face card__face--back"title={symbol}>
        <img src="assets/bg.jpg" alt="bg">
    </div>
  </div>
</div>

<script>
    import { boardState } from '../store.js';
    import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    export let symbol;

    boardState.subscribe(state => {

        if($boardState.guessedItems.indexOf(symbol) > -1 ) return;

        if($boardState.toRemove === symbol && !front && $boardState.guessedItems.indexOf(symbol) == -1) {
            front = !front;
              boardState.update(state => {
                const newState = {
                  ...state
                }
                newState.toRemove = null;
                newState.guessedItems = state.guessedItems
                return newState
            });
        }
    });

    let front = true;
    function wrapCard(){
        
        if($boardState.guessedItems.indexOf(symbol) > -1 ) return;

        dispatch('turn', {
            name: symbol
            })

        boardState.update(state => {
            state.openedItems.push(symbol)
            return {
              ...state
            }
        });
        front = !front;
        
    }
</script>

<style>

.scene {
  width: 100px;
  height: 90px;
  margin: 5px;
  perspective: 500px;
  display: inline-block;
}

.card {
  width: 100%;
  height: 100%;
  transition: transform 1s;
  transform-style: preserve-3d;
  cursor: pointer;
  position: relative;
  border: 1px solid #ddd;
}

.card.flipped {
  transform: rotateY(180deg);
}
/* .card:hover {
  transform: scale(1.1);
} */

.card__face {
  position: absolute;
  width: 100%;
  height: 100%;
  color: white;
  text-align: center;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.card__face--front {
  background: #fff;
}

.card__face--front img {
  user-select: none;
}

.card__face--back {
  background: #5e5e5e;
  transform: rotateY(180deg);
}
.card__face--back img {
    width: 79px;
    height: 70px;
    opacity: .3;
    margin-top: 12px;
    user-select: none;
}
</style>