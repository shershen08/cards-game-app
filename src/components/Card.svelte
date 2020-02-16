<div class="scene scene--card">
  <div class="card" on:click={wrapCard} class:flipped="{front}">
    <div class="card__face card__face--front"><img src={symbol} alt={symbol}></div>
    <div class="card__face card__face--back"title={symbol}>
        <img src="assets/bg.png" alt="bg">
    </div>
  </div>
</div>

<script>
    import { boardState } from '@/store/index.js';
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