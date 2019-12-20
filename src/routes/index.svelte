

<script>
  import { onMount, createEventDispatcher, tick } from 'svelte';

  import Button, {Label} from '@smui/button';

  import Card from '../components/Card.svelte';
  import DialogScores from '../components/DialogScores.svelte';
  import DialogEndGame from '../components/DialogEndGame.svelte';
  import Pannel from '../components/Pannel.svelte';
  
  import { boardState, count, dialogs } from '../store/index.js';
  import {defaultState} from '../store/default';
  import {prepareCards, formatTime} from '../utils';

	let size;
	let cards;
	let fieldWidth;
	let totalTmeToWin;

	$: cssWidth = `width: ${fieldWidth}px;padding-top: 50px;`

   function onGameOver(event){
		dialogs.update(old => {
          return {
            ...old,
        	endofgame: true
          }
        })
		totalTmeToWin = event.detail.time;
	}

	onMount(async () => {
		restart()
	});

	async function startNewGameWithSameParams(){
		cards = []
		totalTmeToWin = 0;
		await tick();
		restart()
	}

	async function startNewGame(event){
		fieldWidth = event.detail.settings.fieldWidth
		size = event.detail.settings.size
		startNewGameWithSameParams();
	}

	function restart(){
		boardState.update(_ => ({
			...defaultState,
			guessedItems: [],
			gameStart: new Date()
		}))
		cards = prepareCards(size)
		count.reset()
	}

	function checkAmount() {

		if($boardState.openedItems.length > 1 && $boardState.openedItems[0] === $boardState.openedItems[1]){
			
			boardState.update(state => {
				 const newState = {
					 ...state,
					guessedItems:$boardState.guessedItems.length ? [...$boardState.guessedItems, $boardState.openedItems[1]] : [$boardState.openedItems[1]],
					openedItems: [],
				}
				return newState;
			})

		} else {
			if($boardState.openedItems.length > 1) {
				
				boardState.update(state => {
					const newState = {
						...state,
						toRemove: $boardState.openedItems[0],
						openedItems: $boardState.openedItems.splice(1, 3),
						guessedItems: $boardState.guessedItems,
						gameStart: $boardState.gameStart,
					}
					return newState;
				})
			}
		}
	}

</script>

<Pannel on:new={startNewGame}
		on:gameover={onGameOver}/>

<DialogScores></DialogScores>
<DialogEndGame totalTmeToWin={totalTmeToWin} on:newgame={startNewGameWithSameParams}></DialogEndGame>

<section style="{cssWidth}">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`assets/logos/${card}.gif`} on:turn={checkAmount}/>
		{/each}
	{/if}
</section>

