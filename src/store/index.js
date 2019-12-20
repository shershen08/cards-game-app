import { writable, readable, derived } from 'svelte/store';
import {defaultState} from './default';

export const boardState = writable(defaultState);

function createCount() {
	const { subscribe, set, update } = writable(new Date().getTime());
	
	let tick = true;
	let interval;
	let pauseTime;

	function init(){
		return setInterval(() => {
			if(tick) {
				set(new Date().getTime());
			}
		}, 1000);
	}

	interval = init()

	return {
		subscribe,
		stop: () => {
			clearInterval(interval);
		},
		pause: () => {
			tick = !tick
		},
		reset: () => {
			tick = true;
			interval = init()
		}
	};
}

export const count = createCount();

export const dialogs = writable({
	records: false,
	endofgame: false
});