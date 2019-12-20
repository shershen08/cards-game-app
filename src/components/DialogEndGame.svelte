
<script>
    import Dialog, {Title, Content, Actions} from '@smui/dialog';
    import Button, {Label} from '@smui/button';

    import { dialogs } from '../store/index.js';

    import {formatTime} from '../utils';

    import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

    export let openEndOfTheGameDialog;
    export let totalTmeToWin;

    function shareProgress(){
        //todo, new click event
        const button = document.querySelector('.twitter-share-button');
        button.click();
    }

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
  <Title id="dialog-title">Game over</Title>
  <Content id="dialog-content">
    Congratultations, you are all done with this set of cards!<br>
	It only took you <strong>{formatTime(totalTmeToWin)}</strong>.
  </Content>
  <Actions>
    <Button>
      <Label on:click={shareProgress}>Share</Label>
    </Button>
    <Button on:click={startNewGame}>
      <Label>New game</Label>
    </Button>
  </Actions>
</Dialog>