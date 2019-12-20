<script>
    import Button, {Label, Icon} from '@smui/button';
    import Select, {Option} from '@smui/select';
    import Card from '@smui/card';

    import { createEventDispatcher, onMount } from 'svelte';
    import { boardState, count, dialogs } from '../store/index.js';
    
    import { formatTime } from '../utils';
    import { saveRecord } from '../record';

    const dispatch = createEventDispatcher();

  
    let fieldSettingsIndex = 0;
    let fieldSettings = $boardState.setups[fieldSettingsIndex];

    $: fieldSettings = $boardState.setups[fieldSettingsIndex];
    $: elapsedTime = parseInt(($count - $boardState.gameStart)/1000)

    boardState.subscribe(state => {
        if(state.guessedItems.length >= fieldSettings.size/2 -1 ){
            count.stop();
            saveRecord(fieldSettings.size, elapsedTime)
            dispatch('gameover', {
                time: elapsedTime
            })
        }
    })

    function togglePause(){
        count.pause()
    }

    function passStartNewGame(){
        dispatch('new', {
            settings: fieldSettings
        })
    }
    function showRecords(){
        dialogs.update(old => {
          return {
            ...old,
            records: true
          }
        })
    }

    onMount(() => {
        passStartNewGame();
    })
</script>

<Card>
    <div class="mdc-layout-grid">
    <div class="mdc-layout-grid__inner">
        <div class="mdc-layout-grid__cell">
            <Button on:click={passStartNewGame} variant="raised"><Label>new game</Label></Button>
            <Button on:click={showRecords}><Label>records</Label></Button>
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
                Opened {$boardState.guessedItems.length} of 
                {fieldSettings.size/2}
            </div>
        </section>
        </div>
    </div>
    </div> 
</Card>