import cardsNames from './cards';

const getRandomInt = (max) => Math.floor(Math.random() * Math.floor(max))

export const prepareCards = (size) => {

    let start = getRandomInt(cardsNames.length)
    let cardsGroup = cardsNames.slice(start, start + size/2) 
    if(cardsNames.length - start < size/2) {
        const leftFromFront = size/2 - cardsNames.length + start
        cardsGroup = cardsGroup.concat(cardsNames.slice(0, leftFromFront))
    }
    return [...cardsGroup, ...cardsGroup].sort(() => Math.random() - 0.5);
}
    
function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

export const formatTime = (time) => {
    var minutes = Math.floor(time / 60);
    var seconds = time - minutes * 60;
    return str_pad_left(minutes,'0',2)+':'+str_pad_left(seconds,'0',2);
}