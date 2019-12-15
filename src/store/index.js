import { writable, readable, derived } from 'svelte/store';
import {defaultState} from './default';

export const boardState = writable(defaultState);

function createCount() {
	const { subscribe, set, update } = writable(new Date());
	
	let tick = true;
	let interval;

	function init(){
		return setInterval(() => {
			if(tick) {
				set(new Date());
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
			clearInterval(interval);
			tick = true;
			interval = init()
			return set(new Date())
		}
	};
}

export const count = createCount();