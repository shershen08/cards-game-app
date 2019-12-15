<script>
    import Button, {Label, Icon} from '@smui/button';
    import Select, {Option} from '@smui/select';
    import Card from '@smui/card';

    import { createEventDispatcher, afterUpdate } from 'svelte';
    import { boardState, count } from '../store/index.js';
    
    import { formatTime } from '../utils';

    const dispatch = createEventDispatcher();

  
    let fieldSettingsIndex = 0;
    let fieldSettings = $boardState.setups[fieldSettingsIndex];

    $: fieldSettings = $boardState.setups[fieldSettingsIndex];
    $: elapsedTime = parseInt(($count.getTime() - $boardState.gameStart.getTime())/1000)

    boardState.subscribe(state => {
        if(state.guessedItems.length >= fieldSettings.size/2 -1 ){
            count.stop();
            dispatch('gameover', {
                time: elapsedTime
            })
        }
    })

    function togglePause(){
        //TODO
    }

    function passStartNewGame(){
        dispatch('new', {
            settings: fieldSettings
        })
    }
</script>

<Card padded>

    <div class="mdc-layout-grid">
    <div class="mdc-layout-grid__inner">
        <div class="mdc-layout-grid__cell">
            <Button on:click={passStartNewGame} variant="raised"><Label>new game</Label></Button>
        </div>
        <div class="mdc-layout-grid__cell">
            <Select bind:value={fieldSettingsIndex} label="Size">
                {#each $boardState.setups as setup, index}
                    <Option value={index} selected={fieldSettings.size == setup.size}>{setup.title}</Option>
                {/each}
            </Select>
        </div>
        <div class="mdc-layout-grid__cell">
        <section class="mdc-typography--body1">
            <Button on:click={togglePause}><Label>pause</Label></Button>
            <strong>{formatTime(elapsedTime)}</strong>
            <div>
                {$boardState.guessedItems.length} of 
                {fieldSettings.size/2}
            </div>
        </section>
        </div>
    </div>
    </div> 
</Card>