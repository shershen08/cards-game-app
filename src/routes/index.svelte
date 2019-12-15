

<script>
  import Dialog, {Title, Content, Actions} from '@smui/dialog';
  import Button, {Label} from '@smui/button';

  import Card from '../components/Card.svelte';
  import Pannel from '../components/Pannel.svelte';
  import { onMount, createEventDispatcher, tick } from 'svelte';

  import { boardState, count } from '../store/index.js';
  import {defaultState} from '../store/default';
  import {prepareCards, formatTime} from '../utils';

const dispatch = createEventDispatcher();

  let dialog;
	let size;
	let boardWidthSetting;
	let cards;
	let fieldWidth;
	let totalTmeToWin;

	$: cssWidth = `width: ${fieldWidth}px;padding-top: 50px;`

  function closeHandler(){

  }

  function onGameOver(event){
	dialog.open();
	totalTmeToWin = event.detail.time;
  }

  function shareProgress(){
	  //TODO
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
					 ...defaultState,
					guessedItems:$boardState.guessedItems.length ? [...$boardState.guessedItems, $boardState.openedItems[1]] : [$boardState.openedItems[1]],
					openedItems: [],
				}
				return newState;
			})

		} else {
			if($boardState.openedItems.length > 1) {
				
				boardState.update(state => {
					const newState = {
						...defaultState,
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

<Pannel on:new={startNewGame} on:gameover={onGameOver}/>

<Dialog
  bind:this={dialog}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
  on:MDCDialog:closed={closeHandler}
>
  <Title id="dialog-title">Game over</Title>
  <Content id="dialog-content">
    Congratultations, you are all done with this set of cards!<br>
	It only took you {formatTime(totalTmeToWin)}.
  </Content>
  <Actions>
      <a href="https://twitter.com/share?" class="twitter-share-button"  data-text="Card memory game with #svelte" data-show-count="true">Tweet</a>
    <!-- <Button>
      <Label on:click={shareProgress}>Share</Label>
    </Button> -->
    <Button on:click={startNewGameWithSameParams}>
      <Label>New game</Label>
    </Button>
  </Actions>
</Dialog>

<section style="{cssWidth}">
	{#if cards} 
		{#each cards as card}
			<Card symbol={`assets/logos/${card}.gif`} on:turn={checkAmount}/>
		{/each}
	{/if}
</section>

