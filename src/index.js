/* global document */
import React from 'react'
import PropTypes from 'prop-types'

const passive = { passive: false }
const defaultProps = {
  eventListenerOptions: passive,
  preventDefaultTouchmoveEvent: true,
  stopPropagation: false,
  delta: 10,
  rotationAngle: 0,
  trackMouse: false,
  trackTouch: true
}
const initialState = {
  xy: [0, 0],
  swiping: false,
  lastEventData: undefined,
  start: undefined
}
export const LEFT = 'Left'
export const RIGHT = 'Right'
export const UP = 'Up'
export const DOWN = 'Down'
const touchMove = 'touchmove'
const touchEnd = 'touchend'
const mouseMove = 'mousemove'
const mouseUp = 'mouseup'

function getDirection(absX, absY, deltaX, deltaY) {
  if (absX > absY) {
    if (deltaX > 0) {
      return LEFT
    }
    return RIGHT
  } else if (deltaY > 0) {
    return UP
  }
  return DOWN
}

function rotateXYByAngle(pos, angle) {
  if (angle === 0) return pos
  const angleInRadians = (Math.PI / 180) * angle
  const x =
    pos[0] * Math.cos(angleInRadians) + pos[1] * Math.sin(angleInRadians)
  const y =
    pos[1] * Math.cos(angleInRadians) - pos[0] * Math.sin(angleInRadians)
  return [x, y]
}

function getHandlers(set, props) {
  const onStart = event => {
    // if more than a single touch don't track, for now...
    if (event.touches && event.touches.length > 1) return

    set(() => {
      const { clientX, clientY } = event.touches ? event.touches[0] : event
      const xy = rotateXYByAngle([clientX, clientY], props.rotationAngle)
      return { ...initialState, xy, start: Date.now() }
    })
  }

  const onMove = event => {
    set(state => {
      if (
        !state.xy[0] ||
        !state.xy[1] ||
        (event.touches && event.touches.length > 1)
      ) {
        return state
      }
      const { clientX, clientY } = event.touches ? event.touches[0] : event
      const [x, y] = rotateXYByAngle([clientX, clientY], props.rotationAngle)
      const deltaX = state.xy[0] - x
      const deltaY = state.xy[1] - y
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      const time = Date.now() - state.start
      const velocity = Math.sqrt(absX * absX + absY * absY) / time

      // if swipe is under delta and we have not started to track a swipe: skip update
      if (absX < props.delta && absY < props.delta && !state.swiping)
        return state

      if (props.stopPropagation) event.stopPropagation()

      const dir = getDirection(absX, absY, deltaX, deltaY)
      const eventData = { event, absX, absY, deltaX, deltaY, velocity, dir }

      props.onSwiping && props.onSwiping(eventData)

      // track if a swipe is cancelable
      // so we can call prevenDefault if needed
      let cancelablePageSwipe = false
      if (props.onSwiping || props.onSwiped || props[`onSwiped${dir}`]) {
        cancelablePageSwipe = true
      }

      if (cancelablePageSwipe && props.preventDefaultTouchmoveEvent)
        event.preventDefault()

      return { ...state, lastEventData: eventData, swiping: true }
    })
  }

  const onEnd = event => {
    set(state => {
      if (state.swiping) {
        if (props.stopPropagation) event.stopPropagation()

        const eventData = { ...state.lastEventData, event }

        props.onSwiped && props.onSwiped(eventData)

        props[`onSwiped${eventData.dir}`] &&
          props[`onSwiped${eventData.dir}`](eventData)
      }
      return { ...initialState }
    })
  }

  const onDown = e => {
    if (props.trackMouse) {
      document.addEventListener(mouseMove, onMove)
      document.addEventListener(mouseUp, onUp)
    }
    if (props.trackTouch) {
      document.addEventListener(touchMove, onMove, props.eventListenerOptions)
      document.addEventListener(touchEnd, onUp, props.eventListenerOptions)
    }
    onStart(e)
  }

  const stop = () => {
    if (props.trackMouse) {
      document.removeEventListener(mouseMove, onMove)
      document.removeEventListener(mouseUp, onUp)
    }
    if (props.trackTouch) {
      document.removeEventListener(
        touchMove,
        onMove,
        props.eventListenerOptions
      )
      document.removeEventListener(touchEnd, onUp, props.eventListenerOptions)
    }
  }

  const onUp = e => {
    stop()
    onEnd(e)
  }

  const output = {}
  if (props.trackMouse) {
    output.onMouseDown = onDown
  }
  if (props.trackTouch) {
    output.onTouchStart = onDown
  }

  return output
}

export function useSwipeable(props) {
  const transientState = React.useRef(initialState)
  const [spread] = React.useState(() => currentProps =>
    getHandlers(cb => (transientState.current = cb(transientState.current)), {
      ...defaultProps,
      ...currentProps
    })
  )
  return spread(props)
}

export class Swipeable extends React.Component {
  static propTypes = {
    onSwiped: PropTypes.func,
    onSwiping: PropTypes.func,
    onSwipedUp: PropTypes.func,
    onSwipedRight: PropTypes.func,
    onSwipedDown: PropTypes.func,
    onSwipedLeft: PropTypes.func,
    delta: PropTypes.number,
    preventDefaultTouchmoveEvent: PropTypes.bool,
    stopPropagation: PropTypes.bool,
    nodeName: PropTypes.string,
    trackMouse: PropTypes.bool,
    trackTouch: PropTypes.bool,
    innerRef: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.shape({ current: PropTypes.any })
    ]),
    rotationAngle: PropTypes.number
  }

  static defaultProps = defaultProps

  constructor(props) {
    super(props)
    this._state = initialState
    this._set = cb => (this._state = cb(this._state))
  }

  render() {
    const { className, style, nodeName = 'div', innerRef, ...rest } = this.props
    const handlers = getHandlers(this._set, rest)
    return React.createElement(
      nodeName,
      { ...handlers, className, style, ref: innerRef },
      this.props.children
    )
  }
}
