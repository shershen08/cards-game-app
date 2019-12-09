import { writable, readable, derived } from 'svelte/store';

export const defaultState = {
    openedItems: [],
    guessedItems: [],
	toRemove: null,
	gameStart: new Date()
};

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
		reset: () => {
			clearInterval(interval);
			return set(new Date())
		}
	};
}

export const count = createCount();