
export const defaultState = {
    openedItems: [],
    guessedItems: [],
	toRemove: null,
	gameStart: new Date().getTime(),
	setups: [{
		title: 'small',
		size: 16,
		fieldWidth: 440
	},
	{
		title: 'big',
		size: 36,
		fieldWidth: 660
	},
	{
		title: 'huge',
		size: 100,
		fieldWidth: 1100
	}]
};