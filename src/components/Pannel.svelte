<script>
    import Button, {Label, Icon} from '@smui/button';
    import Select, {Option} from '@smui/select';
      import Card, {Content, PrimaryAction, Media, MediaContent, Actions, ActionButtons, ActionIcons} from '@smui/card';


    let fruits = ['Apple', 'Orange', 'Banana', 'Mango'];
    let fruitChoice = '';

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

<Card padded>
    
    <Button on:click={passStartNewGame} variant="raised"><Label>new game</Label></Button>


    <Select bind:value={selectedFieldSize} label="size">
        <Option value="16">16</Option>
        {#each fieldSizes as size}
            <Option value={size} selected={selectedFieldSize === size}>{size}</Option>
        {/each}
    </Select>

    <section class="mdc-typography--body1">
        <strong>{formatTime(elapsedTime)}</strong>

        <div>
            {$boardState.guessedItems.length} of {selectedFieldSize/2}
        </div>
    </section>
</Card>