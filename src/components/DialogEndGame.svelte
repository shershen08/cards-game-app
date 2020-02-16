
<script>
    import Dialog, {Title, Content, Actions} from '@smui/dialog';
    import Button, {Label} from '@smui/button';

    import { dialogs } from '@/store/index.js';

    import {formatTime} from '@/utils.js';

    import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

    export let openEndOfTheGameDialog;
    export let totalTmeToWin;

//     function shareProgress(){
// debugger
//         var evt = new MouseEvent("click", {
//         bubbles: true,
//         cancelable: true,
//         view: window
//       });
//         const button = document.querySelector('.twitter-share-button');
//         // button.click();
//         button.dispatchEvent(evt);
//     }

    function startNewGame(){
      dispatch('newgame')
    }

      dialogs.subscribe(state => {
        if (state.endofgame) {
          openEndOfTheGameDialog.open();
        }
     })

</script>

<Dialog
  bind:this={openEndOfTheGameDialog}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
  <Title id="dialog-title">Game over</Title>
  <Content id="dialog-content">
    Congratultations, you are all done with this set of cards!<br>
	It only took you <strong>{formatTime(totalTmeToWin)}</strong>.
  </Content>
  <Actions>
      <a href="https://twitter.com/share?" class="twitter-share-button"  data-text="My record is in card memory game with #svelte" data-show-count="true">Share result</a>
      {formatTime(totalTmeToWin)} 
    <Button on:click={startNewGame}>
      <Label>New game</Label>
    </Button>
  </Actions>
</Dialog>