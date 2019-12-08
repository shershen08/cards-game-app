import { writable } from 'svelte/store';

export const boardState = writable({
    openedItems: [],
    guessedItems: []
});