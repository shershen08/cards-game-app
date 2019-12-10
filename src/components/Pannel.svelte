<script>
    import { createEventDispatcher } from 'svelte';
    import { boardState, count } from '../store.js';

    const dispatch = createEventDispatcher();
    
function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

function formatTime(time){
    var minutes = Math.floor(time / 60);
    var seconds = time - minutes * 60;
    return str_pad_left(minutes,'0',2)+':'+str_pad_left(seconds,'0',2);
}

let selectedFieldSize;

	$: elapsedTime = parseInt(($count.getTime() - $boardState.gameStart.getTime())/1000)

	boardState.subscribe(state => {
		if(state.guessedItems.length >= selectedFieldSize/2 -1 ){
			console.log('Game over', elapsedTime)
			count.stop();
		}
	})

export let fieldSizes;

function passStartNewGame(){
    dispatch('new', {
        size: selectedFieldSize
    })
}

</script>

<button on:click={passStartNewGame}>new game</button>

<select bind:value={selectedFieldSize}>
    {#each fieldSizes as size}
        <option value={size}>
            {size}
        </option>
    {/each}
</select>

<strong>{formatTime(elapsedTime)}</strong>

<div>
	{$boardState.guessedItems.length} of TODO
    <!-- {selectedFieldSize/2} -->
</div>