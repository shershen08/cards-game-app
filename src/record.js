const KEY = 'cards-game-'
export const saveRecord = (size, time) => {
    let record = window.localStorage.getItem(`${KEY}${size}`)
    if(isNaN(parseInt(record)) || parseInt(record) > time) {
        window.localStorage.setItem(`${KEY}${size}`, time)
    }
}
export const getRecords = (size) => {
    let record = window.localStorage.getItem(`${KEY}${size}`)
    if(!isNaN(parseInt(record))) {
        return parseInt(record);
    }
}