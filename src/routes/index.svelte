

<script>
	import Card from '../components/Card.svelte';
	import Pannel from '../components/Pannel.svelte';
	import cardsNames from './cards.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { boardState, defaultState, count } from '../store.js';

	const dispatch = createEventDispatcher();
	
	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}
	
	const fieldSizes = [16, 36, 100]

	//todo
	const setups = [{
		title: 'small',
		size: 16,
		fieldWidth: 440
	},
	{
		title: 'big',
		size: 36,
		fieldWidth: 640
	},
	{
		title: 'huge',
		size: 100,
		fieldWidth: 800
	}]
	let selectedFieldSize = fieldSizes[0];
	let isBigSize = false;
	let cards;

	onMount(async () => {
		restart()
	});

	function startNewGame(event){
		selectedFieldSize = event.detail.size;
		cards = []
		setTimeout(() => {
			restart()
		})
	}

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

<Pannel fieldSizes={fieldSizes} on:new={startNewGame}/>

<!-- {JSON.stringify($boardState)} -->
<section class="game-board" class:sizeBig="{isBigSize}">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`assets/logos/${card}.gif`} on:turn={checkAmount}/>
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