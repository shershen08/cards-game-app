

<script>
	import Card from '../components/Card.svelte';
	import cardsNames from './cards.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { boardState, defaultState, count } from '../store.js';

	const dispatch = createEventDispatcher();
	
	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}
	
	const fieldSizes = [16, 36]
	let selectedFieldSize = fieldSizes[0];
	let isBigSize = false;
	//let TOTAL_CARDS = !isBigSize ? fieldSizes[0] : fieldSizes[1];
	let cards;

	onMount(async () => {
		restart()
	});

	function restart(){
		isBigSize = selectedFieldSize > 20;
		boardState.update(_ => ({
			...defaultState,
			guessedItems: [],
			gameStart: new Date()
		}))

		//prepare cards
		let start = getRandomInt(cardsNames.length)
		let cardsGroup = cardsNames.slice(start, start + selectedFieldSize/2) 
		if(cardsNames.length - start < selectedFieldSize/2) {
			const leftFromFront = selectedFieldSize/2 - cardsNames.length + start
			cardsGroup = cardsGroup.concat(cardsNames.slice(0, leftFromFront))
		}
		cards = [...cardsGroup, ...cardsGroup].sort(() => Math.random() - 0.5);
	}

	$: elapsedTime = parseInt(($count.getTime() - $boardState.gameStart.getTime())/1000)

	boardState.subscribe(state => {
		if($boardState.guessedItems.length >= selectedFieldSize/2 -1 ){
			console.log('Game over', elapsedTime)
			count.stop();
		}
	})

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

<select bind:value={selectedFieldSize}>
		{#each fieldSizes as size}
			<option value={size}>
				{size}
			</option>
		{/each}
	</select>

<strong>{elapsedTime}</strong>

<div>
	{$boardState.guessedItems.length} of {selectedFieldSize/2}
</div>
<hr>

<!-- {JSON.stringify($boardState)} -->
<section class="game-board" class:sizeBig="{isBigSize}">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`/logos/${card}.gif`} on:turn={checkAmount}/>
		{/each}
	{/if}
</section>

<style>
.game-board {
	width: 460px;
}
.game-board.sizeBig {
	width: 660px;
}
</style>