
<script>
    import Dialog, {Title, Content, Actions} from '@smui/dialog';
    import Button, {Label} from '@smui/button';

    import {formatTime} from '../utils';
    import { dialogs } from '../store/index.js';

    let openRecordsDialog;
    const recordsValues = 42;

    function onRecordsClose(){
	    	dialogs.update(old => {
          return {
            ...old,
            records: false
          }
        })
    }

     dialogs.subscribe(state => {
        if (state.records) {
          openRecordsDialog.open();
        }
     })


</script>

<Dialog
  bind:this={openRecordsDialog}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
>
  <Title id="dialog-title">Your records</Title>
  <Content id="dialog-content">
		{recordsValues}
  </Content>
  <Actions>
    <Button on:click={onRecordsClose}>
      <Label>Close</Label>
    </Button>
  </Actions>
</Dialog>