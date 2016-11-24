const Dragula = require('dragula')

export default function (initialContainers, options) {
  return new Dragula(initialContainers, options).configured()
}
