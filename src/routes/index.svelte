

<script>
	import Card from '../components/Card.svelte';
	import cardsNames from './cards.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { boardState } from '../store.js';

	const dispatch = createEventDispatcher();
	
	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}

	let cards;

	onMount(async () => {
		let start = getRandomInt(cardsNames.length)
		const cardsGroup = cardsNames.splice(start, 8) 
		cards = [...cardsGroup, ...cardsGroup]
	});
	function checkAmount() {
		if($boardState.openedItems > 2) {
			console.log($boardState.openedItems)
			boardState.update(state => {
				state.openedItems.splice(1,3)
				return state
			})
		}

		if($boardState.openedItems[0] === $boardState.openedItems[1]){
			boardState.update(state => {
				state.guessedItems.push($boardState.openedItems[1])
				state.openedItems = []
				return state
			})
		}
	}

</script>
<svelte:head>
	<title>Card game with </title>
</svelte:head>
{JSON.stringify($boardState)}
<section class="game-board">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`/logos/${card}.gif`} on:turn={checkAmount}/>
		{/each}
	{/if}
</section>

<style>
.game-board {
	width: 550px;
}
</style>