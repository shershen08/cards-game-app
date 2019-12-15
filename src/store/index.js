import { writable, readable, derived } from 'svelte/store';
import {defaultState} from './default';

export const boardState = writable(defaultState);

function createCount() {
	const { subscribe, set, update } = writable(new Date());

	const interval = setInterval(() => {
		set(new Date());
	}, 1000);

	return {
		subscribe,
		stop: () => {
			clearInterval(interval);
		},
		pause: () => {
			// todo
		},
		reset: () => {
			clearInterval(interval);
			return set(new Date())
		}
	};
}

export const count = createCount();