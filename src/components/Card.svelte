<div class="scene scene--card">
  <div class="card" on:click={wrapCard} class:flipped="{front}">
    <div class="card__face card__face--front"><img src={symbol} alt='card'></div>
    <div class="card__face card__face--back">back</div>
  </div>
</div>

<script>
    import { boardState } from '../store.js';
    import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    export let symbol;

    let front = true;
    function wrapCard(){
        if($boardState.guessedItems.indexOf(symbol) > -1 ) return;

        dispatch('turn', symbol)
        
        boardState.update(state => {
            state.openedItems.push(symbol)
            return state
        });
        front = !front;
        
       // setTimeout(() => {
            
        //}, 300)
        
    }
</script>

<style>

.scene {
  width: 100px;
  height: 90px;
  margin: 10px;
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
}

.card.flipped {
  transform: rotateY(180deg);
}

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

.card__face--back {
  background: #999;
  transform: rotateY(180deg);
}
</style>