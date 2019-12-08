

<script>
	import Card from '../components/Card.svelte';
	import cardsNames from './cards.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { boardState, defaultState, count } from '../store.js';

	const dispatch = createEventDispatcher();
	
	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}

	const TOTAL_CARDS = 36;
	let cards;

	onMount(async () => {
		restart()
	});

	function restart(){
		boardState.update(_ => ({
			...defaultState,
			guessedItems: [],
			gameStart: new Date()
		}))
		let start = getRandomInt(cardsNames.length)
		const cardsGroup = cardsNames.splice(start, TOTAL_CARDS/2) 
		cards = [...cardsGroup, ...cardsGroup].sort(() => Math.random() - 0.5);
		//count.reset();
	}

	$: elapsedTime = parseInt(($count.getTime() - $boardState.gameStart.getTime())/1000)

	function checkAmount() {

		if($boardState.openedItems.length > 1 && $boardState.openedItems[0] === $boardState.openedItems[1]){
			
			boardState.update(state => {
				 const newState = {
					guessedItems:$boardState.guessedItems.length ? [...$boardState.guessedItems, $boardState.openedItems[1]] : [$boardState.openedItems[1]],
					toRemove: null,
					openedItems: [],
					gameStart: state.gameStart
				}
				return newState;
			})

			if($boardState.guessedItems.length === TOTAL_CARDS/2){
				console.log('Game over', elapsedTime)
			}


		} else {
			if($boardState.openedItems.length > 1) {
				
				boardState.update(state => {
					const newState = {
						toRemove: $boardState.openedItems[0],
						openedItems: $boardState.openedItems.splice(1, 3),
						guessedItems: $boardState.guessedItems,
						gameStart: $boardState.gameStart
					}
					return newState;
				})
			}
		}
	}

</script>
<svelte:head>
	<title>Card game with </title>
</svelte:head>

<button on:click={restart}>new game</button>

<strong>{elapsedTime}</strong>

<div>
	{$boardState.guessedItems.length} of {TOTAL_CARDS/2}
</div>
<hr>

<!-- {JSON.stringify($boardState)} -->
<section class="game-board">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`/logos/${card}.gif`} on:turn={checkAmount}/>
		{/each}
	{/if}
</section>

<style>
.game-board {
	width: 660px;
}
</style>