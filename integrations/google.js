
module.exports = google => {
    if (typeof google != 'object') return console.error('invalid instance')

    // do nothing since default is google integration
    return google
}
