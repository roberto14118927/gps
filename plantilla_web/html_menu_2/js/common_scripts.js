/**!
 * @fileOverview Kickass library to create and place poppers near their reference elements.
 * @version 1.11.0
 * @license
 * Copyright (c) 2016 Federico Zivolo and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Popper = factory());
}(this, (function () { 'use strict';

var nativeHints = ['native code', '[object MutationObserverConstructor]'];

/**
 * Determine if a function is implemented natively (as opposed to a polyfill).
 * @method
 * @memberof Popper.Utils
 * @argument {Function | undefined} fn the function to check
 * @returns {Boolean}
 */
var isNative = (function (fn) {
  return nativeHints.some(function (hint) {
    return (fn || '').toString().indexOf(hint) > -1;
  });
});

var isBrowser = typeof window !== 'undefined';
var longerTimeoutBrowsers = ['Edge', 'Trident', 'Firefox'];
var timeoutDuration = 0;
for (var i = 0; i < longerTimeoutBrowsers.length; i += 1) {
  if (isBrowser && navigator.userAgent.indexOf(longerTimeoutBrowsers[i]) >= 0) {
    timeoutDuration = 1;
    break;
  }
}

function microtaskDebounce(fn) {
  var scheduled = false;
  var i = 0;
  var elem = document.createElement('span');

  // MutationObserver provides a mechanism for scheduling microtasks, which
  // are scheduled *before* the next task. This gives us a way to debounce
  // a function but ensure it's called *before* the next paint.
  var observer = new MutationObserver(function () {
    fn();
    scheduled = false;
  });

  observer.observe(elem, { attributes: true });

  return function () {
    if (!scheduled) {
      scheduled = true;
      elem.setAttribute('x-index', i);
      i = i + 1; // don't use compund (+=) because it doesn't get optimized in V8
    }
  };
}

function taskDebounce(fn) {
  var scheduled = false;
  return function () {
    if (!scheduled) {
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        fn();
      }, timeoutDuration);
    }
  };
}

// It's common for MutationObserver polyfills to be seen in the wild, however
// these rely on Mutation Events which only occur when an element is connected
// to the DOM. The algorithm used in this module does not use a connected element,
// and so we must ensure that a *native* MutationObserver is available.
var supportsNativeMutationObserver = isBrowser && isNative(window.MutationObserver);

/**
* Create a debounced version of a method, that's asynchronously deferred
* but called in the minimum time possible.
*
* @method
* @memberof Popper.Utils
* @argument {Function} fn
* @returns {Function}
*/
var debounce = supportsNativeMutationObserver ? microtaskDebounce : taskDebounce;

/**
 * Check if the given variable is a function
 * @method
 * @memberof Popper.Utils
 * @argument {Any} functionToCheck - variable to check
 * @returns {Boolean} answer to: is a function?
 */
function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

/**
 * Get CSS computed property of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Eement} element
 * @argument {String} property
 */
function getStyleComputedProperty(element, property) {
  if (element.nodeType !== 1) {
    return [];
  }
  // NOTE: 1 DOM access here
  var css = window.getComputedStyle(element, null);
  return property ? css[property] : css;
}

/**
 * Returns the parentNode or the host of the element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} parent
 */
function getParentNode(element) {
  if (element.nodeName === 'HTML') {
    return element;
  }
  return element.parentNode || element.host;
}

/**
 * Returns the scrolling parent of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} scroll parent
 */
function getScrollParent(element) {
  // Return body, `getScroll` will take care to get the correct `scrollTop` from it
  if (!element || ['HTML', 'BODY', '#document'].indexOf(element.nodeName) !== -1) {
    return window.document.body;
  }

  // Firefox want us to check `-x` and `-y` variations as well

  var _getStyleComputedProp = getStyleComputedProperty(element),
      overflow = _getStyleComputedProp.overflow,
      overflowX = _getStyleComputedProp.overflowX,
      overflowY = _getStyleComputedProp.overflowY;

  if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
    return element;
  }

  return getScrollParent(getParentNode(element));
}

/**
 * Returns the offset parent of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} offset parent
 */
function getOffsetParent(element) {
  // NOTE: 1 DOM access here
  var offsetParent = element && element.offsetParent;
  var nodeName = offsetParent && offsetParent.nodeName;

  if (!nodeName || nodeName === 'BODY' || nodeName === 'HTML') {
    return window.document.documentElement;
  }

  // .offsetParent will return the closest TD or TABLE in case
  // no offsetParent is present, I hate this job...
  if (['TD', 'TABLE'].indexOf(offsetParent.nodeName) !== -1 && getStyleComputedProperty(offsetParent, 'position') === 'static') {
    return getOffsetParent(offsetParent);
  }

  return offsetParent;
}

function isOffsetContainer(element) {
  var nodeName = element.nodeName;

  if (nodeName === 'BODY') {
    return false;
  }
  return nodeName === 'HTML' || getOffsetParent(element.firstElementChild) === element;
}

/**
 * Finds the root node (document, shadowDOM root) of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} node
 * @returns {Element} root node
 */
function getRoot(node) {
  if (node.parentNode !== null) {
    return getRoot(node.parentNode);
  }

  return node;
}

/**
 * Finds the offset parent common to the two provided nodes
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element1
 * @argument {Element} element2
 * @returns {Element} common offset parent
 */
function findCommonOffsetParent(element1, element2) {
  // This check is needed to avoid errors in case one of the elements isn't defined for any reason
  if (!element1 || !element1.nodeType || !element2 || !element2.nodeType) {
    return window.document.documentElement;
  }

  // Here we make sure to give as "start" the element that comes first in the DOM
  var order = element1.compareDocumentPosition(element2) & Node.DOCUMENT_POSITION_FOLLOWING;
  var start = order ? element1 : element2;
  var end = order ? element2 : element1;

  // Get common ancestor container
  var range = document.createRange();
  range.setStart(start, 0);
  range.setEnd(end, 0);
  var commonAncestorContainer = range.commonAncestorContainer;

  // Both nodes are inside #document

  if (element1 !== commonAncestorContainer && element2 !== commonAncestorContainer || start.contains(end)) {
    if (isOffsetContainer(commonAncestorContainer)) {
      return commonAncestorContainer;
    }

    return getOffsetParent(commonAncestorContainer);
  }

  // one of the nodes is inside shadowDOM, find which one
  var element1root = getRoot(element1);
  if (element1root.host) {
    return findCommonOffsetParent(element1root.host, element2);
  } else {
    return findCommonOffsetParent(element1, getRoot(element2).host);
  }
}

/**
 * Gets the scroll value of the given element in the given side (top and left)
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @argument {String} side `top` or `left`
 * @returns {number} amount of scrolled pixels
 */
function getScroll(element) {
  var side = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'top';

  var upperSide = side === 'top' ? 'scrollTop' : 'scrollLeft';
  var nodeName = element.nodeName;

  if (nodeName === 'BODY' || nodeName === 'HTML') {
    var html = window.document.documentElement;
    var scrollingElement = window.document.scrollingElement || html;
    return scrollingElement[upperSide];
  }

  return element[upperSide];
}

/*
 * Sum or subtract the element scroll values (left and top) from a given rect object
 * @method
 * @memberof Popper.Utils
 * @param {Object} rect - Rect object you want to change
 * @param {HTMLElement} element - The element from the function reads the scroll values
 * @param {Boolean} subtract - set to true if you want to subtract the scroll values
 * @return {Object} rect - The modifier rect object
 */
function includeScroll(rect, element) {
  var subtract = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var scrollTop = getScroll(element, 'top');
  var scrollLeft = getScroll(element, 'left');
  var modifier = subtract ? -1 : 1;
  rect.top += scrollTop * modifier;
  rect.bottom += scrollTop * modifier;
  rect.left += scrollLeft * modifier;
  rect.right += scrollLeft * modifier;
  return rect;
}

/*
 * Helper to detect borders of a given element
 * @method
 * @memberof Popper.Utils
 * @param {CSSStyleDeclaration} styles
 * Result of `getStyleComputedProperty` on the given element
 * @param {String} axis - `x` or `y`
 * @return {number} borders - The borders size of the given axis
 */

function getBordersSize(styles, axis) {
  var sideA = axis === 'x' ? 'Left' : 'Top';
  var sideB = sideA === 'Left' ? 'Right' : 'Bottom';

  return +styles['border' + sideA + 'Width'].split('px')[0] + +styles['border' + sideB + 'Width'].split('px')[0];
}

/**
 * Tells if you are running Internet Explorer 10
 * @method
 * @memberof Popper.Utils
 * @returns {Boolean} isIE10
 */
var isIE10 = undefined;

var isIE10$1 = function () {
  if (isIE10 === undefined) {
    isIE10 = navigator.appVersion.indexOf('MSIE 10') !== -1;
  }
  return isIE10;
};

function getSize(axis, body, html, computedStyle) {
  return Math.max(body['offset' + axis], html['client' + axis], html['offset' + axis], isIE10$1() ? html['offset' + axis] + computedStyle['margin' + (axis === 'Height' ? 'Top' : 'Left')] + computedStyle['margin' + (axis === 'Height' ? 'Bottom' : 'Right')] : 0);
}

function getWindowSizes() {
  var body = window.document.body;
  var html = window.document.documentElement;
  var computedStyle = isIE10$1() && window.getComputedStyle(html);

  return {
    height: getSize('Height', body, html, computedStyle),
    width: getSize('Width', body, html, computedStyle)
  };
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();





var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

/**
 * Given element offsets, generate an output similar to getBoundingClientRect
 * @method
 * @memberof Popper.Utils
 * @argument {Object} offsets
 * @returns {Object} ClientRect like output
 */
function getClientRect(offsets) {
  return _extends({}, offsets, {
    right: offsets.left + offsets.width,
    bottom: offsets.top + offsets.height
  });
}

/**
 * Get bounding client rect of given element
 * @method
 * @memberof Popper.Utils
 * @param {HTMLElement} element
 * @return {Object} client rect
 */
function getBoundingClientRect(element) {
  var rect = {};

  // IE10 10 FIX: Please, don't ask, the element isn't
  // considered in DOM in some circumstances...
  // This isn't reproducible in IE10 compatibility mode of IE11
  if (isIE10$1()) {
    try {
      rect = element.getBoundingClientRect();
      var scrollTop = getScroll(element, 'top');
      var scrollLeft = getScroll(element, 'left');
      rect.top += scrollTop;
      rect.left += scrollLeft;
      rect.bottom += scrollTop;
      rect.right += scrollLeft;
    } catch (err) {}
  } else {
    rect = element.getBoundingClientRect();
  }

  var result = {
    left: rect.left,
    top: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top
  };

  // subtract scrollbar size from sizes
  var sizes = element.nodeName === 'HTML' ? getWindowSizes() : {};
  var width = sizes.width || element.clientWidth || result.right - result.left;
  var height = sizes.height || element.clientHeight || result.bottom - result.top;

  var horizScrollbar = element.offsetWidth - width;
  var vertScrollbar = element.offsetHeight - height;

  // if an hypothetical scrollbar is detected, we must be sure it's not a `border`
  // we make this check conditional for performance reasons
  if (horizScrollbar || vertScrollbar) {
    var styles = getStyleComputedProperty(element);
    horizScrollbar -= getBordersSize(styles, 'x');
    vertScrollbar -= getBordersSize(styles, 'y');

    result.width -= horizScrollbar;
    result.height -= vertScrollbar;
  }

  return getClientRect(result);
}

function getOffsetRectRelativeToArbitraryNode(children, parent) {
  var isIE10 = isIE10$1();
  var isHTML = parent.nodeName === 'HTML';
  var childrenRect = getBoundingClientRect(children);
  var parentRect = getBoundingClientRect(parent);
  var scrollParent = getScrollParent(children);

  var styles = getStyleComputedProperty(parent);
  var borderTopWidth = +styles.borderTopWidth.split('px')[0];
  var borderLeftWidth = +styles.borderLeftWidth.split('px')[0];

  var offsets = getClientRect({
    top: childrenRect.top - parentRect.top - borderTopWidth,
    left: childrenRect.left - parentRect.left - borderLeftWidth,
    width: childrenRect.width,
    height: childrenRect.height
  });
  offsets.marginTop = 0;
  offsets.marginLeft = 0;

  // Subtract margins of documentElement in case it's being used as parent
  // we do this only on HTML because it's the only element that behaves
  // differently when margins are applied to it. The margins are included in
  // the box of the documentElement, in the other cases not.
  if (!isIE10 && isHTML) {
    var marginTop = +styles.marginTop.split('px')[0];
    var marginLeft = +styles.marginLeft.split('px')[0];

    offsets.top -= borderTopWidth - marginTop;
    offsets.bottom -= borderTopWidth - marginTop;
    offsets.left -= borderLeftWidth - marginLeft;
    offsets.right -= borderLeftWidth - marginLeft;

    // Attach marginTop and marginLeft because in some circumstances we may need them
    offsets.marginTop = marginTop;
    offsets.marginLeft = marginLeft;
  }

  if (isIE10 ? parent.contains(scrollParent) : parent === scrollParent && scrollParent.nodeName !== 'BODY') {
    offsets = includeScroll(offsets, parent);
  }

  return offsets;
}

function getViewportOffsetRectRelativeToArtbitraryNode(element) {
  var html = window.document.documentElement;
  var relativeOffset = getOffsetRectRelativeToArbitraryNode(element, html);
  var width = Math.max(html.clientWidth, window.innerWidth || 0);
  var height = Math.max(html.clientHeight, window.innerHeight || 0);

  var scrollTop = getScroll(html);
  var scrollLeft = getScroll(html, 'left');

  var offset = {
    top: scrollTop - relativeOffset.top + relativeOffset.marginTop,
    left: scrollLeft - relativeOffset.left + relativeOffset.marginLeft,
    width: width,
    height: height
  };

  return getClientRect(offset);
}

/**
 * Check if the given element is fixed or is inside a fixed parent
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @argument {Element} customContainer
 * @returns {Boolean} answer to "isFixed?"
 */
function isFixed(element) {
  var nodeName = element.nodeName;
  if (nodeName === 'BODY' || nodeName === 'HTML') {
    return false;
  }
  if (getStyleComputedProperty(element, 'position') === 'fixed') {
    return true;
  }
  return isFixed(getParentNode(element));
}

/**
 * Computed the boundaries limits and return them
 * @method
 * @memberof Popper.Utils
 * @param {HTMLElement} popper
 * @param {HTMLElement} reference
 * @param {number} padding
 * @param {HTMLElement} boundariesElement - Element used to define the boundaries
 * @returns {Object} Coordinates of the boundaries
 */
function getBoundaries(popper, reference, padding, boundariesElement) {
  // NOTE: 1 DOM access here
  var boundaries = { top: 0, left: 0 };
  var offsetParent = findCommonOffsetParent(popper, reference);

  // Handle viewport case
  if (boundariesElement === 'viewport') {
    boundaries = getViewportOffsetRectRelativeToArtbitraryNode(offsetParent);
  } else {
    // Handle other cases based on DOM element used as boundaries
    var boundariesNode = void 0;
    if (boundariesElement === 'scrollParent') {
      boundariesNode = getScrollParent(getParentNode(popper));
      if (boundariesNode.nodeName === 'BODY') {
        boundariesNode = window.document.documentElement;
      }
    } else if (boundariesElement === 'window') {
      boundariesNode = window.document.documentElement;
    } else {
      boundariesNode = boundariesElement;
    }

    var offsets = getOffsetRectRelativeToArbitraryNode(boundariesNode, offsetParent);

    // In case of HTML, we need a different computation
    if (boundariesNode.nodeName === 'HTML' && !isFixed(offsetParent)) {
      var _getWindowSizes = getWindowSizes(),
          height = _getWindowSizes.height,
          width = _getWindowSizes.width;

      boundaries.top += offsets.top - offsets.marginTop;
      boundaries.bottom = height + offsets.top;
      boundaries.left += offsets.left - offsets.marginLeft;
      boundaries.right = width + offsets.left;
    } else {
      // for all the other DOM elements, this one is good
      boundaries = offsets;
    }
  }

  // Add paddings
  boundaries.left += padding;
  boundaries.top += padding;
  boundaries.right -= padding;
  boundaries.bottom -= padding;

  return boundaries;
}

function getArea(_ref) {
  var width = _ref.width,
      height = _ref.height;

  return width * height;
}

/**
 * Utility used to transform the `auto` placement to the placement with more
 * available space.
 * @method
 * @memberof Popper.Utils
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function computeAutoPlacement(placement, refRect, popper, reference, boundariesElement) {
  var padding = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 0;

  if (placement.indexOf('auto') === -1) {
    return placement;
  }

  var boundaries = getBoundaries(popper, reference, padding, boundariesElement);

  var rects = {
    top: {
      width: boundaries.width,
      height: refRect.top - boundaries.top
    },
    right: {
      width: boundaries.right - refRect.right,
      height: boundaries.height
    },
    bottom: {
      width: boundaries.width,
      height: boundaries.bottom - refRect.bottom
    },
    left: {
      width: refRect.left - boundaries.left,
      height: boundaries.height
    }
  };

  var sortedAreas = Object.keys(rects).map(function (key) {
    return _extends({
      key: key
    }, rects[key], {
      area: getArea(rects[key])
    });
  }).sort(function (a, b) {
    return b.area - a.area;
  });

  var filteredAreas = sortedAreas.filter(function (_ref2) {
    var width = _ref2.width,
        height = _ref2.height;
    return width >= popper.clientWidth && height >= popper.clientHeight;
  });

  var computedPlacement = filteredAreas.length > 0 ? filteredAreas[0].key : sortedAreas[0].key;

  var variation = placement.split('-')[1];

  return computedPlacement + (variation ? '-' + variation : '');
}

/**
 * Get offsets to the reference element
 * @method
 * @memberof Popper.Utils
 * @param {Object} state
 * @param {Element} popper - the popper element
 * @param {Element} reference - the reference element (the popper will be relative to this)
 * @returns {Object} An object containing the offsets which will be applied to the popper
 */
function getReferenceOffsets(state, popper, reference) {
  var commonOffsetParent = findCommonOffsetParent(popper, reference);
  return getOffsetRectRelativeToArbitraryNode(reference, commonOffsetParent);
}

/**
 * Get the outer sizes of the given element (offset size + margins)
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Object} object containing width and height properties
 */
function getOuterSizes(element) {
  var styles = window.getComputedStyle(element);
  var x = parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
  var y = parseFloat(styles.marginLeft) + parseFloat(styles.marginRight);
  var result = {
    width: element.offsetWidth + y,
    height: element.offsetHeight + x
  };
  return result;
}

/**
 * Get the opposite placement of the given one
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement
 * @returns {String} flipped placement
 */
function getOppositePlacement(placement) {
  var hash = { left: 'right', right: 'left', bottom: 'top', top: 'bottom' };
  return placement.replace(/left|right|bottom|top/g, function (matched) {
    return hash[matched];
  });
}

/**
 * Get offsets to the popper
 * @method
 * @memberof Popper.Utils
 * @param {Object} position - CSS position the Popper will get applied
 * @param {HTMLElement} popper - the popper element
 * @param {Object} referenceOffsets - the reference offsets (the popper will be relative to this)
 * @param {String} placement - one of the valid placement options
 * @returns {Object} popperOffsets - An object containing the offsets which will be applied to the popper
 */
function getPopperOffsets(popper, referenceOffsets, placement) {
  placement = placement.split('-')[0];

  // Get popper node sizes
  var popperRect = getOuterSizes(popper);

  // Add position, width and height to our offsets object
  var popperOffsets = {
    width: popperRect.width,
    height: popperRect.height
  };

  // depending by the popper placement we have to compute its offsets slightly differently
  var isHoriz = ['right', 'left'].indexOf(placement) !== -1;
  var mainSide = isHoriz ? 'top' : 'left';
  var secondarySide = isHoriz ? 'left' : 'top';
  var measurement = isHoriz ? 'height' : 'width';
  var secondaryMeasurement = !isHoriz ? 'height' : 'width';

  popperOffsets[mainSide] = referenceOffsets[mainSide] + referenceOffsets[measurement] / 2 - popperRect[measurement] / 2;
  if (placement === secondarySide) {
    popperOffsets[secondarySide] = referenceOffsets[secondarySide] - popperRect[secondaryMeasurement];
  } else {
    popperOffsets[secondarySide] = referenceOffsets[getOppositePlacement(secondarySide)];
  }

  return popperOffsets;
}

/**
 * Mimics the `find` method of Array
 * @method
 * @memberof Popper.Utils
 * @argument {Array} arr
 * @argument prop
 * @argument value
 * @returns index or -1
 */
function find(arr, check) {
  // use native find if supported
  if (Array.prototype.find) {
    return arr.find(check);
  }

  // use `filter` to obtain the same behavior of `find`
  return arr.filter(check)[0];
}

/**
 * Return the index of the matching object
 * @method
 * @memberof Popper.Utils
 * @argument {Array} arr
 * @argument prop
 * @argument value
 * @returns index or -1
 */
function findIndex(arr, prop, value) {
  // use native findIndex if supported
  if (Array.prototype.findIndex) {
    return arr.findIndex(function (cur) {
      return cur[prop] === value;
    });
  }

  // use `find` + `indexOf` if `findIndex` isn't supported
  var match = find(arr, function (obj) {
    return obj[prop] === value;
  });
  return arr.indexOf(match);
}

/**
 * Loop trough the list of modifiers and run them in order,
 * each of them will then edit the data object.
 * @method
 * @memberof Popper.Utils
 * @param {dataObject} data
 * @param {Array} modifiers
 * @param {String} ends - Optional modifier name used as stopper
 * @returns {dataObject}
 */
function runModifiers(modifiers, data, ends) {
  var modifiersToRun = ends === undefined ? modifiers : modifiers.slice(0, findIndex(modifiers, 'name', ends));

  modifiersToRun.forEach(function (modifier) {
    if (modifier.function) {
      console.warn('`modifier.function` is deprecated, use `modifier.fn`!');
    }
    var fn = modifier.function || modifier.fn;
    if (modifier.enabled && isFunction(fn)) {
      // Add properties to offsets to make them a complete clientRect object
      // we do this before each modifier to make sure the previous one doesn't
      // mess with these values
      data.offsets.popper = getClientRect(data.offsets.popper);
      data.offsets.reference = getClientRect(data.offsets.reference);

      data = fn(data, modifier);
    }
  });

  return data;
}

/**
 * Updates the position of the popper, computing the new offsets and applying
 * the new style.<br />
 * Prefer `scheduleUpdate` over `update` because of performance reasons.
 * @method
 * @memberof Popper
 */
function update() {
  // if popper is destroyed, don't perform any further update
  if (this.state.isDestroyed) {
    return;
  }

  var data = {
    instance: this,
    styles: {},
    attributes: {},
    flipped: false,
    offsets: {}
  };

  // compute reference element offsets
  data.offsets.reference = getReferenceOffsets(this.state, this.popper, this.reference);

  // compute auto placement, store placement inside the data object,
  // modifiers will be able to edit `placement` if needed
  // and refer to originalPlacement to know the original value
  data.placement = computeAutoPlacement(this.options.placement, data.offsets.reference, this.popper, this.reference, this.options.modifiers.flip.boundariesElement, this.options.modifiers.flip.padding);

  // store the computed placement inside `originalPlacement`
  data.originalPlacement = data.placement;

  // compute the popper offsets
  data.offsets.popper = getPopperOffsets(this.popper, data.offsets.reference, data.placement);
  data.offsets.popper.position = 'absolute';

  // run the modifiers
  data = runModifiers(this.modifiers, data);

  // the first `update` will call `onCreate` callback
  // the other ones will call `onUpdate` callback
  if (!this.state.isCreated) {
    this.state.isCreated = true;
    this.options.onCreate(data);
  } else {
    this.options.onUpdate(data);
  }
}

/**
 * Helper used to know if the given modifier is enabled.
 * @method
 * @memberof Popper.Utils
 * @returns {Boolean}
 */
function isModifierEnabled(modifiers, modifierName) {
  return modifiers.some(function (_ref) {
    var name = _ref.name,
        enabled = _ref.enabled;
    return enabled && name === modifierName;
  });
}

/**
 * Get the prefixed supported property name
 * @method
 * @memberof Popper.Utils
 * @argument {String} property (camelCase)
 * @returns {String} prefixed property (camelCase or PascalCase, depending on the vendor prefix)
 */
function getSupportedPropertyName(property) {
  var prefixes = [false, 'ms', 'Webkit', 'Moz', 'O'];
  var upperProp = property.charAt(0).toUpperCase() + property.slice(1);

  for (var i = 0; i < prefixes.length - 1; i++) {
    var prefix = prefixes[i];
    var toCheck = prefix ? '' + prefix + upperProp : property;
    if (typeof window.document.body.style[toCheck] !== 'undefined') {
      return toCheck;
    }
  }
  return null;
}

/**
 * Destroy the popper
 * @method
 * @memberof Popper
 */
function destroy() {
  this.state.isDestroyed = true;

  // touch DOM only if `applyStyle` modifier is enabled
  if (isModifierEnabled(this.modifiers, 'applyStyle')) {
    this.popper.removeAttribute('x-placement');
    this.popper.style.left = '';
    this.popper.style.position = '';
    this.popper.style.top = '';
    this.popper.style[getSupportedPropertyName('transform')] = '';
  }

  this.disableEventListeners();

  // remove the popper if user explicity asked for the deletion on destroy
  // do not use `remove` because IE11 doesn't support it
  if (this.options.removeOnDestroy) {
    this.popper.parentNode.removeChild(this.popper);
  }
  return this;
}

function attachToScrollParents(scrollParent, event, callback, scrollParents) {
  var isBody = scrollParent.nodeName === 'BODY';
  var target = isBody ? window : scrollParent;
  target.addEventListener(event, callback, { passive: true });

  if (!isBody) {
    attachToScrollParents(getScrollParent(target.parentNode), event, callback, scrollParents);
  }
  scrollParents.push(target);
}

/**
 * Setup needed event listeners used to update the popper position
 * @method
 * @memberof Popper.Utils
 * @private
 */
function setupEventListeners(reference, options, state, updateBound) {
  // Resize event listener on window
  state.updateBound = updateBound;
  window.addEventListener('resize', state.updateBound, { passive: true });

  // Scroll event listener on scroll parents
  var scrollElement = getScrollParent(reference);
  attachToScrollParents(scrollElement, 'scroll', state.updateBound, state.scrollParents);
  state.scrollElement = scrollElement;
  state.eventsEnabled = true;

  return state;
}

/**
 * It will add resize/scroll events and start recalculating
 * position of the popper element when they are triggered.
 * @method
 * @memberof Popper
 */
function enableEventListeners() {
  if (!this.state.eventsEnabled) {
    this.state = setupEventListeners(this.reference, this.options, this.state, this.scheduleUpdate);
  }
}

/**
 * Remove event listeners used to update the popper position
 * @method
 * @memberof Popper.Utils
 * @private
 */
function removeEventListeners(reference, state) {
  // Remove resize event listener on window
  window.removeEventListener('resize', state.updateBound);

  // Remove scroll event listener on scroll parents
  state.scrollParents.forEach(function (target) {
    target.removeEventListener('scroll', state.updateBound);
  });

  // Reset state
  state.updateBound = null;
  state.scrollParents = [];
  state.scrollElement = null;
  state.eventsEnabled = false;
  return state;
}

/**
 * It will remove resize/scroll events and won't recalculate popper position
 * when they are triggered. It also won't trigger onUpdate callback anymore,
 * unless you call `update` method manually.
 * @method
 * @memberof Popper
 */
function disableEventListeners() {
  if (this.state.eventsEnabled) {
    window.cancelAnimationFrame(this.scheduleUpdate);
    this.state = removeEventListeners(this.reference, this.state);
  }
}

/**
 * Tells if a given input is a number
 * @method
 * @memberof Popper.Utils
 * @param {*} input to check
 * @return {Boolean}
 */
function isNumeric(n) {
  return n !== '' && !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Set the style to the given popper
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element - Element to apply the style to
 * @argument {Object} styles
 * Object with a list of properties and values which will be applied to the element
 */
function setStyles(element, styles) {
  Object.keys(styles).forEach(function (prop) {
    var unit = '';
    // add unit if the value is numeric and is one of the following
    if (['width', 'height', 'top', 'right', 'bottom', 'left'].indexOf(prop) !== -1 && isNumeric(styles[prop])) {
      unit = 'px';
    }
    element.style[prop] = styles[prop] + unit;
  });
}

/**
 * Set the attributes to the given popper
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element - Element to apply the attributes to
 * @argument {Object} styles
 * Object with a list of properties and values which will be applied to the element
 */
function setAttributes(element, attributes) {
  Object.keys(attributes).forEach(function (prop) {
    var value = attributes[prop];
    if (value !== false) {
      element.setAttribute(prop, attributes[prop]);
    } else {
      element.removeAttribute(prop);
    }
  });
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} data.styles - List of style properties - values to apply to popper element
 * @argument {Object} data.attributes - List of attribute properties - values to apply to popper element
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The same data object
 */
function applyStyle(data) {
  // any property present in `data.styles` will be applied to the popper,
  // in this way we can make the 3rd party modifiers add custom styles to it
  // Be aware, modifiers could override the properties defined in the previous
  // lines of this modifier!
  setStyles(data.instance.popper, data.styles);

  // any property present in `data.attributes` will be applied to the popper,
  // they will be set as HTML attributes of the element
  setAttributes(data.instance.popper, data.attributes);

  // if the arrow style has been computed, apply the arrow style
  if (data.offsets.arrow) {
    setStyles(data.arrowElement, data.offsets.arrow);
  }

  return data;
}

/**
 * Set the x-placement attribute before everything else because it could be used
 * to add margins to the popper margins needs to be calculated to get the
 * correct popper offsets.
 * @method
 * @memberof Popper.modifiers
 * @param {HTMLElement} reference - The reference element used to position the popper
 * @param {HTMLElement} popper - The HTML element used as popper.
 * @param {Object} options - Popper.js options
 */
function applyStyleOnLoad(reference, popper, options, modifierOptions, state) {
  // compute reference element offsets
  var referenceOffsets = getReferenceOffsets(state, popper, reference);

  // compute auto placement, store placement inside the data object,
  // modifiers will be able to edit `placement` if needed
  // and refer to originalPlacement to know the original value
  var placement = computeAutoPlacement(options.placement, referenceOffsets, popper, reference, options.modifiers.flip.boundariesElement, options.modifiers.flip.padding);

  popper.setAttribute('x-placement', placement);

  // Apply `position` to popper before anything else because
  // without the position applied we can't guarantee correct computations
  setStyles(popper, { position: 'absolute' });

  return options;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function computeStyle(data, options) {
  var x = options.x,
      y = options.y;
  var popper = data.offsets.popper;

  // Remove this legacy support in Popper.js v2

  var legacyGpuAccelerationOption = find(data.instance.modifiers, function (modifier) {
    return modifier.name === 'applyStyle';
  }).gpuAcceleration;
  if (legacyGpuAccelerationOption !== undefined) {
    console.warn('WARNING: `gpuAcceleration` option moved to `computeStyle` modifier and will not be supported in future versions of Popper.js!');
  }
  var gpuAcceleration = legacyGpuAccelerationOption !== undefined ? legacyGpuAccelerationOption : options.gpuAcceleration;

  var offsetParent = getOffsetParent(data.instance.popper);
  var offsetParentRect = getBoundingClientRect(offsetParent);

  // Styles
  var styles = {
    position: popper.position
  };

  // floor sides to avoid blurry text
  var offsets = {
    left: Math.floor(popper.left),
    top: Math.floor(popper.top),
    bottom: Math.floor(popper.bottom),
    right: Math.floor(popper.right)
  };

  var sideA = x === 'bottom' ? 'top' : 'bottom';
  var sideB = y === 'right' ? 'left' : 'right';

  // if gpuAcceleration is set to `true` and transform is supported,
  //  we use `translate3d` to apply the position to the popper we
  // automatically use the supported prefixed version if needed
  var prefixedProperty = getSupportedPropertyName('transform');

  // now, let's make a step back and look at this code closely (wtf?)
  // If the content of the popper grows once it's been positioned, it
  // may happen that the popper gets misplaced because of the new content
  // overflowing its reference element
  // To avoid this problem, we provide two options (x and y), which allow
  // the consumer to define the offset origin.
  // If we position a popper on top of a reference element, we can set
  // `x` to `top` to make the popper grow towards its top instead of
  // its bottom.
  var left = void 0,
      top = void 0;
  if (sideA === 'bottom') {
    top = -offsetParentRect.height + offsets.bottom;
  } else {
    top = offsets.top;
  }
  if (sideB === 'right') {
    left = -offsetParentRect.width + offsets.right;
  } else {
    left = offsets.left;
  }
  if (gpuAcceleration && prefixedProperty) {
    styles[prefixedProperty] = 'translate3d(' + left + 'px, ' + top + 'px, 0)';
    styles[sideA] = 0;
    styles[sideB] = 0;
    styles.willChange = 'transform';
  } else {
    // othwerise, we use the standard `top`, `left`, `bottom` and `right` properties
    var invertTop = sideA === 'bottom' ? -1 : 1;
    var invertLeft = sideB === 'right' ? -1 : 1;
    styles[sideA] = top * invertTop;
    styles[sideB] = left * invertLeft;
    styles.willChange = sideA + ', ' + sideB;
  }

  // Attributes
  var attributes = {
    'x-placement': data.placement
  };

  // Update attributes and styles of `data`
  data.attributes = _extends({}, attributes, data.attributes);
  data.styles = _extends({}, styles, data.styles);

  return data;
}

/**
 * Helper used to know if the given modifier depends from another one.<br />
 * It checks if the needed modifier is listed and enabled.
 * @method
 * @memberof Popper.Utils
 * @param {Array} modifiers - list of modifiers
 * @param {String} requestingName - name of requesting modifier
 * @param {String} requestedName - name of requested modifier
 * @returns {Boolean}
 */
function isModifierRequired(modifiers, requestingName, requestedName) {
  var requesting = find(modifiers, function (_ref) {
    var name = _ref.name;
    return name === requestingName;
  });

  var isRequired = !!requesting && modifiers.some(function (modifier) {
    return modifier.name === requestedName && modifier.enabled && modifier.order < requesting.order;
  });

  if (!isRequired) {
    var _requesting = '`' + requestingName + '`';
    var requested = '`' + requestedName + '`';
    console.warn(requested + ' modifier is required by ' + _requesting + ' modifier in order to work, be sure to include it before ' + _requesting + '!');
  }
  return isRequired;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function arrow(data, options) {
  // arrow depends on keepTogether in order to work
  if (!isModifierRequired(data.instance.modifiers, 'arrow', 'keepTogether')) {
    return data;
  }

  var arrowElement = options.element;

  // if arrowElement is a string, suppose it's a CSS selector
  if (typeof arrowElement === 'string') {
    arrowElement = data.instance.popper.querySelector(arrowElement);

    // if arrowElement is not found, don't run the modifier
    if (!arrowElement) {
      return data;
    }
  } else {
    // if the arrowElement isn't a query selector we must check that the
    // provided DOM node is child of its popper node
    if (!data.instance.popper.contains(arrowElement)) {
      console.warn('WARNING: `arrow.element` must be child of its popper element!');
      return data;
    }
  }

  var placement = data.placement.split('-')[0];
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var isVertical = ['left', 'right'].indexOf(placement) !== -1;

  var len = isVertical ? 'height' : 'width';
  var side = isVertical ? 'top' : 'left';
  var altSide = isVertical ? 'left' : 'top';
  var opSide = isVertical ? 'bottom' : 'right';
  var arrowElementSize = getOuterSizes(arrowElement)[len];

  //
  // extends keepTogether behavior making sure the popper and its reference have enough pixels in conjuction
  //

  // top/left side
  if (reference[opSide] - arrowElementSize < popper[side]) {
    data.offsets.popper[side] -= popper[side] - (reference[opSide] - arrowElementSize);
  }
  // bottom/right side
  if (reference[side] + arrowElementSize > popper[opSide]) {
    data.offsets.popper[side] += reference[side] + arrowElementSize - popper[opSide];
  }

  // compute center of the popper
  var center = reference[side] + reference[len] / 2 - arrowElementSize / 2;

  // Compute the sideValue using the updated popper offsets
  var sideValue = center - getClientRect(data.offsets.popper)[side];

  // prevent arrowElement from being placed not contiguously to its popper
  sideValue = Math.max(Math.min(popper[len] - arrowElementSize, sideValue), 0);

  data.arrowElement = arrowElement;
  data.offsets.arrow = {};
  data.offsets.arrow[side] = Math.round(sideValue);
  data.offsets.arrow[altSide] = ''; // make sure to unset any eventual altSide value from the DOM node

  return data;
}

/**
 * Get the opposite placement variation of the given one
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement variation
 * @returns {String} flipped placement variation
 */
function getOppositeVariation(variation) {
  if (variation === 'end') {
    return 'start';
  } else if (variation === 'start') {
    return 'end';
  }
  return variation;
}

/**
 * List of accepted placements to use as values of the `placement` option.<br />
 * Valid placements are:
 * - `auto`
 * - `top`
 * - `right`
 * - `bottom`
 * - `left`
 *
 * Each placement can have a variation from this list:
 * - `-start`
 * - `-end`
 *
 * Variations are interpreted easily if you think of them as the left to right
 * written languages. Horizontally (`top` and `bottom`), `start` is left and `end`
 * is right.<br />
 * Vertically (`left` and `right`), `start` is top and `end` is bottom.
 *
 * Some valid examples are:
 * - `top-end` (on top of reference, right aligned)
 * - `right-start` (on right of reference, top aligned)
 * - `bottom` (on bottom, centered)
 * - `auto-right` (on the side with more space available, alignment depends by placement)
 *
 * @static
 * @type {Array}
 * @enum {String}
 * @readonly
 * @method placements
 * @memberof Popper
 */
var placements = ['auto-start', 'auto', 'auto-end', 'top-start', 'top', 'top-end', 'right-start', 'right', 'right-end', 'bottom-end', 'bottom', 'bottom-start', 'left-end', 'left', 'left-start'];

// Get rid of `auto` `auto-start` and `auto-end`
var validPlacements = placements.slice(3);

/**
 * Given an initial placement, returns all the subsequent placements
 * clockwise (or counter-clockwise).
 *
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement - A valid placement (it accepts variations)
 * @argument {Boolean} counter - Set to true to walk the placements counterclockwise
 * @returns {Array} placements including their variations
 */
function clockwise(placement) {
  var counter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  var index = validPlacements.indexOf(placement);
  var arr = validPlacements.slice(index + 1).concat(validPlacements.slice(0, index));
  return counter ? arr.reverse() : arr;
}

var BEHAVIORS = {
  FLIP: 'flip',
  CLOCKWISE: 'clockwise',
  COUNTERCLOCKWISE: 'counterclockwise'
};

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function flip(data, options) {
  // if `inner` modifier is enabled, we can't use the `flip` modifier
  if (isModifierEnabled(data.instance.modifiers, 'inner')) {
    return data;
  }

  if (data.flipped && data.placement === data.originalPlacement) {
    // seems like flip is trying to loop, probably there's not enough space on any of the flippable sides
    return data;
  }

  var boundaries = getBoundaries(data.instance.popper, data.instance.reference, options.padding, options.boundariesElement);

  var placement = data.placement.split('-')[0];
  var placementOpposite = getOppositePlacement(placement);
  var variation = data.placement.split('-')[1] || '';

  var flipOrder = [];

  switch (options.behavior) {
    case BEHAVIORS.FLIP:
      flipOrder = [placement, placementOpposite];
      break;
    case BEHAVIORS.CLOCKWISE:
      flipOrder = clockwise(placement);
      break;
    case BEHAVIORS.COUNTERCLOCKWISE:
      flipOrder = clockwise(placement, true);
      break;
    default:
      flipOrder = options.behavior;
  }

  flipOrder.forEach(function (step, index) {
    if (placement !== step || flipOrder.length === index + 1) {
      return data;
    }

    placement = data.placement.split('-')[0];
    placementOpposite = getOppositePlacement(placement);

    var popperOffsets = data.offsets.popper;
    var refOffsets = data.offsets.reference;

    // using floor because the reference offsets may contain decimals we are not going to consider here
    var floor = Math.floor;
    var overlapsRef = placement === 'left' && floor(popperOffsets.right) > floor(refOffsets.left) || placement === 'right' && floor(popperOffsets.left) < floor(refOffsets.right) || placement === 'top' && floor(popperOffsets.bottom) > floor(refOffsets.top) || placement === 'bottom' && floor(popperOffsets.top) < floor(refOffsets.bottom);

    var overflowsLeft = floor(popperOffsets.left) < floor(boundaries.left);
    var overflowsRight = floor(popperOffsets.right) > floor(boundaries.right);
    var overflowsTop = floor(popperOffsets.top) < floor(boundaries.top);
    var overflowsBottom = floor(popperOffsets.bottom) > floor(boundaries.bottom);

    var overflowsBoundaries = placement === 'left' && overflowsLeft || placement === 'right' && overflowsRight || placement === 'top' && overflowsTop || placement === 'bottom' && overflowsBottom;

    // flip the variation if required
    var isVertical = ['top', 'bottom'].indexOf(placement) !== -1;
    var flippedVariation = !!options.flipVariations && (isVertical && variation === 'start' && overflowsLeft || isVertical && variation === 'end' && overflowsRight || !isVertical && variation === 'start' && overflowsTop || !isVertical && variation === 'end' && overflowsBottom);

    if (overlapsRef || overflowsBoundaries || flippedVariation) {
      // this boolean to detect any flip loop
      data.flipped = true;

      if (overlapsRef || overflowsBoundaries) {
        placement = flipOrder[index + 1];
      }

      if (flippedVariation) {
        variation = getOppositeVariation(variation);
      }

      data.placement = placement + (variation ? '-' + variation : '');

      // this object contains `position`, we want to preserve it along with
      // any additional property we may add in the future
      data.offsets.popper = _extends({}, data.offsets.popper, getPopperOffsets(data.instance.popper, data.offsets.reference, data.placement));

      data = runModifiers(data.instance.modifiers, data, 'flip');
    }
  });
  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function keepTogether(data) {
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var placement = data.placement.split('-')[0];
  var floor = Math.floor;
  var isVertical = ['top', 'bottom'].indexOf(placement) !== -1;
  var side = isVertical ? 'right' : 'bottom';
  var opSide = isVertical ? 'left' : 'top';
  var measurement = isVertical ? 'width' : 'height';

  if (popper[side] < floor(reference[opSide])) {
    data.offsets.popper[opSide] = floor(reference[opSide]) - popper[measurement];
  }
  if (popper[opSide] > floor(reference[side])) {
    data.offsets.popper[opSide] = floor(reference[side]);
  }

  return data;
}

/**
 * Converts a string containing value + unit into a px value number
 * @function
 * @memberof {modifiers~offset}
 * @private
 * @argument {String} str - Value + unit string
 * @argument {String} measurement - `height` or `width`
 * @argument {Object} popperOffsets
 * @argument {Object} referenceOffsets
 * @returns {Number|String}
 * Value in pixels, or original string if no values were extracted
 */
function toValue(str, measurement, popperOffsets, referenceOffsets) {
  // separate value from unit
  var split = str.match(/((?:\-|\+)?\d*\.?\d*)(.*)/);
  var value = +split[1];
  var unit = split[2];

  // If it's not a number it's an operator, I guess
  if (!value) {
    return str;
  }

  if (unit.indexOf('%') === 0) {
    var element = void 0;
    switch (unit) {
      case '%p':
        element = popperOffsets;
        break;
      case '%':
      case '%r':
      default:
        element = referenceOffsets;
    }

    var rect = getClientRect(element);
    return rect[measurement] / 100 * value;
  } else if (unit === 'vh' || unit === 'vw') {
    // if is a vh or vw, we calculate the size based on the viewport
    var size = void 0;
    if (unit === 'vh') {
      size = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    } else {
      size = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    }
    return size / 100 * value;
  } else {
    // if is an explicit pixel unit, we get rid of the unit and keep the value
    // if is an implicit unit, it's px, and we return just the value
    return value;
  }
}

/**
 * Parse an `offset` string to extrapolate `x` and `y` numeric offsets.
 * @function
 * @memberof {modifiers~offset}
 * @private
 * @argument {String} offset
 * @argument {Object} popperOffsets
 * @argument {Object} referenceOffsets
 * @argument {String} basePlacement
 * @returns {Array} a two cells array with x and y offsets in numbers
 */
function parseOffset(offset, popperOffsets, referenceOffsets, basePlacement) {
  var offsets = [0, 0];

  // Use height if placement is left or right and index is 0 otherwise use width
  // in this way the first offset will use an axis and the second one
  // will use the other one
  var useHeight = ['right', 'left'].indexOf(basePlacement) !== -1;

  // Split the offset string to obtain a list of values and operands
  // The regex addresses values with the plus or minus sign in front (+10, -20, etc)
  var fragments = offset.split(/(\+|\-)/).map(function (frag) {
    return frag.trim();
  });

  // Detect if the offset string contains a pair of values or a single one
  // they could be separated by comma or space
  var divider = fragments.indexOf(find(fragments, function (frag) {
    return frag.search(/,|\s/) !== -1;
  }));

  if (fragments[divider] && fragments[divider].indexOf(',') === -1) {
    console.warn('Offsets separated by white space(s) are deprecated, use a comma (,) instead.');
  }

  // If divider is found, we divide the list of values and operands to divide
  // them by ofset X and Y.
  var splitRegex = /\s*,\s*|\s+/;
  var ops = divider !== -1 ? [fragments.slice(0, divider).concat([fragments[divider].split(splitRegex)[0]]), [fragments[divider].split(splitRegex)[1]].concat(fragments.slice(divider + 1))] : [fragments];

  // Convert the values with units to absolute pixels to allow our computations
  ops = ops.map(function (op, index) {
    // Most of the units rely on the orientation of the popper
    var measurement = (index === 1 ? !useHeight : useHeight) ? 'height' : 'width';
    var mergeWithPrevious = false;
    return op
    // This aggregates any `+` or `-` sign that aren't considered operators
    // e.g.: 10 + +5 => [10, +, +5]
    .reduce(function (a, b) {
      if (a[a.length - 1] === '' && ['+', '-'].indexOf(b) !== -1) {
        a[a.length - 1] = b;
        mergeWithPrevious = true;
        return a;
      } else if (mergeWithPrevious) {
        a[a.length - 1] += b;
        mergeWithPrevious = false;
        return a;
      } else {
        return a.concat(b);
      }
    }, [])
    // Here we convert the string values into number values (in px)
    .map(function (str) {
      return toValue(str, measurement, popperOffsets, referenceOffsets);
    });
  });

  // Loop trough the offsets arrays and execute the operations
  ops.forEach(function (op, index) {
    op.forEach(function (frag, index2) {
      if (isNumeric(frag)) {
        offsets[index] += frag * (op[index2 - 1] === '-' ? -1 : 1);
      }
    });
  });
  return offsets;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @argument {Number|String} options.offset=0
 * The offset value as described in the modifier description
 * @returns {Object} The data object, properly modified
 */
function offset(data, _ref) {
  var offset = _ref.offset;
  var placement = data.placement,
      _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var basePlacement = placement.split('-')[0];

  var offsets = void 0;
  if (isNumeric(+offset)) {
    offsets = [+offset, 0];
  } else {
    offsets = parseOffset(offset, popper, reference, basePlacement);
  }

  if (basePlacement === 'left') {
    popper.top += offsets[0];
    popper.left -= offsets[1];
  } else if (basePlacement === 'right') {
    popper.top += offsets[0];
    popper.left += offsets[1];
  } else if (basePlacement === 'top') {
    popper.left += offsets[0];
    popper.top -= offsets[1];
  } else if (basePlacement === 'bottom') {
    popper.left += offsets[0];
    popper.top += offsets[1];
  }

  data.popper = popper;
  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function preventOverflow(data, options) {
  var boundariesElement = options.boundariesElement || getOffsetParent(data.instance.popper);

  // If offsetParent is the reference element, we really want to
  // go one step up and use the next offsetParent as reference to
  // avoid to make this modifier completely useless and look like broken
  if (data.instance.reference === boundariesElement) {
    boundariesElement = getOffsetParent(boundariesElement);
  }

  var boundaries = getBoundaries(data.instance.popper, data.instance.reference, options.padding, boundariesElement);
  options.boundaries = boundaries;

  var order = options.priority;
  var popper = data.offsets.popper;

  var check = {
    primary: function primary(placement) {
      var value = popper[placement];
      if (popper[placement] < boundaries[placement] && !options.escapeWithReference) {
        value = Math.max(popper[placement], boundaries[placement]);
      }
      return defineProperty({}, placement, value);
    },
    secondary: function secondary(placement) {
      var mainSide = placement === 'right' ? 'left' : 'top';
      var value = popper[mainSide];
      if (popper[placement] > boundaries[placement] && !options.escapeWithReference) {
        value = Math.min(popper[mainSide], boundaries[placement] - (placement === 'right' ? popper.width : popper.height));
      }
      return defineProperty({}, mainSide, value);
    }
  };

  order.forEach(function (placement) {
    var side = ['left', 'top'].indexOf(placement) !== -1 ? 'primary' : 'secondary';
    popper = _extends({}, popper, check[side](placement));
  });

  data.offsets.popper = popper;

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function shift(data) {
  var placement = data.placement;
  var basePlacement = placement.split('-')[0];
  var shiftvariation = placement.split('-')[1];

  // if shift shiftvariation is specified, run the modifier
  if (shiftvariation) {
    var _data$offsets = data.offsets,
        reference = _data$offsets.reference,
        popper = _data$offsets.popper;

    var isVertical = ['bottom', 'top'].indexOf(basePlacement) !== -1;
    var side = isVertical ? 'left' : 'top';
    var measurement = isVertical ? 'width' : 'height';

    var shiftOffsets = {
      start: defineProperty({}, side, reference[side]),
      end: defineProperty({}, side, reference[side] + reference[measurement] - popper[measurement])
    };

    data.offsets.popper = _extends({}, popper, shiftOffsets[shiftvariation]);
  }

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function hide(data) {
  if (!isModifierRequired(data.instance.modifiers, 'hide', 'preventOverflow')) {
    return data;
  }

  var refRect = data.offsets.reference;
  var bound = find(data.instance.modifiers, function (modifier) {
    return modifier.name === 'preventOverflow';
  }).boundaries;

  if (refRect.bottom < bound.top || refRect.left > bound.right || refRect.top > bound.bottom || refRect.right < bound.left) {
    // Avoid unnecessary DOM access if visibility hasn't changed
    if (data.hide === true) {
      return data;
    }

    data.hide = true;
    data.attributes['x-out-of-boundaries'] = '';
  } else {
    // Avoid unnecessary DOM access if visibility hasn't changed
    if (data.hide === false) {
      return data;
    }

    data.hide = false;
    data.attributes['x-out-of-boundaries'] = false;
  }

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function inner(data) {
  var placement = data.placement;
  var basePlacement = placement.split('-')[0];
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var isHoriz = ['left', 'right'].indexOf(basePlacement) !== -1;

  var subtractLength = ['top', 'left'].indexOf(basePlacement) === -1;

  popper[isHoriz ? 'left' : 'top'] = reference[placement] - (subtractLength ? popper[isHoriz ? 'width' : 'height'] : 0);

  data.placement = getOppositePlacement(placement);
  data.offsets.popper = getClientRect(popper);

  return data;
}

/**
 * Modifier function, each modifier can have a function of this type assigned
 * to its `fn` property.<br />
 * These functions will be called on each update, this means that you must
 * make sure they are performant enough to avoid performance bottlenecks.
 *
 * @function ModifierFn
 * @argument {dataObject} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {dataObject} The data object, properly modified
 */

/**
 * Modifiers are plugins used to alter the behavior of your poppers.<br />
 * Popper.js uses a set of 9 modifiers to provide all the basic functionalities
 * needed by the library.
 *
 * Usually you don't want to override the `order`, `fn` and `onLoad` props.
 * All the other properties are configurations that could be tweaked.
 * @namespace modifiers
 */
var modifiers = {
  /**
   * Modifier used to shift the popper on the start or end of its reference
   * element.<br />
   * It will read the variation of the `placement` property.<br />
   * It can be one either `-end` or `-start`.
   * @memberof modifiers
   * @inner
   */
  shift: {
    /** @prop {number} order=100 - Index used to define the order of execution */
    order: 100,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: shift
  },

  /**
   * The `offset` modifier can shift your popper on both its axis.
   *
   * It accepts the following units:
   * - `px` or unitless, interpreted as pixels
   * - `%` or `%r`, percentage relative to the length of the reference element
   * - `%p`, percentage relative to the length of the popper element
   * - `vw`, CSS viewport width unit
   * - `vh`, CSS viewport height unit
   *
   * For length is intended the main axis relative to the placement of the popper.<br />
   * This means that if the placement is `top` or `bottom`, the length will be the
   * `width`. In case of `left` or `right`, it will be the height.
   *
   * You can provide a single value (as `Number` or `String`), or a pair of values
   * as `String` divided by a comma or one (or more) white spaces.<br />
   * The latter is a deprecated method because it leads to confusion and will be
   * removed in v2.<br />
   * Additionally, it accepts additions and subtractions between different units.
   * Note that multiplications and divisions aren't supported.
   *
   * Valid examples are:
   * ```
   * 10
   * '10%'
   * '10, 10'
   * '10%, 10'
   * '10 + 10%'
   * '10 - 5vh + 3%'
   * '-10px + 5vh, 5px - 6%'
   * ```
   *
   * @memberof modifiers
   * @inner
   */
  offset: {
    /** @prop {number} order=200 - Index used to define the order of execution */
    order: 200,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: offset,
    /** @prop {Number|String} offset=0
     * The offset value as described in the modifier description
     */
    offset: 0
  },

  /**
   * Modifier used to prevent the popper from being positioned outside the boundary.
   *
   * An scenario exists where the reference itself is not within the boundaries.<br />
   * We can say it has "escaped the boundaries" — or just "escaped".<br />
   * In this case we need to decide whether the popper should either:
   *
   * - detach from the reference and remain "trapped" in the boundaries, or
   * - if it should ignore the boundary and "escape with its reference"
   *
   * When `escapeWithReference` is set to`true` and reference is completely
   * outside its boundaries, the popper will overflow (or completely leave)
   * the boundaries in order to remain attached to the edge of the reference.
   *
   * @memberof modifiers
   * @inner
   */
  preventOverflow: {
    /** @prop {number} order=300 - Index used to define the order of execution */
    order: 300,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: preventOverflow,
    /**
     * @prop {Array} [priority=['left','right','top','bottom']]
     * Popper will try to prevent overflow following these priorities by default,
     * then, it could overflow on the left and on top of the `boundariesElement`
     */
    priority: ['left', 'right', 'top', 'bottom'],
    /**
     * @prop {number} padding=5
     * Amount of pixel used to define a minimum distance between the boundaries
     * and the popper this makes sure the popper has always a little padding
     * between the edges of its container
     */
    padding: 5,
    /**
     * @prop {String|HTMLElement} boundariesElement='scrollParent'
     * Boundaries used by the modifier, can be `scrollParent`, `window`,
     * `viewport` or any DOM element.
     */
    boundariesElement: 'scrollParent'
  },

  /**
   * Modifier used to make sure the reference and its popper stay near eachothers
   * without leaving any gap between the two. Expecially useful when the arrow is
   * enabled and you want to assure it to point to its reference element.
   * It cares only about the first axis, you can still have poppers with margin
   * between the popper and its reference element.
   * @memberof modifiers
   * @inner
   */
  keepTogether: {
    /** @prop {number} order=400 - Index used to define the order of execution */
    order: 400,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: keepTogether
  },

  /**
   * This modifier is used to move the `arrowElement` of the popper to make
   * sure it is positioned between the reference element and its popper element.
   * It will read the outer size of the `arrowElement` node to detect how many
   * pixels of conjuction are needed.
   *
   * It has no effect if no `arrowElement` is provided.
   * @memberof modifiers
   * @inner
   */
  arrow: {
    /** @prop {number} order=500 - Index used to define the order of execution */
    order: 500,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: arrow,
    /** @prop {String|HTMLElement} element='[x-arrow]' - Selector or node used as arrow */
    element: '[x-arrow]'
  },

  /**
   * Modifier used to flip the popper's placement when it starts to overlap its
   * reference element.
   *
   * Requires the `preventOverflow` modifier before it in order to work.
   *
   * **NOTE:** this modifier will interrupt the current update cycle and will
   * restart it if it detects the need to flip the placement.
   * @memberof modifiers
   * @inner
   */
  flip: {
    /** @prop {number} order=600 - Index used to define the order of execution */
    order: 600,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: flip,
    /**
     * @prop {String|Array} behavior='flip'
     * The behavior used to change the popper's placement. It can be one of
     * `flip`, `clockwise`, `counterclockwise` or an array with a list of valid
     * placements (with optional variations).
     */
    behavior: 'flip',
    /**
     * @prop {number} padding=5
     * The popper will flip if it hits the edges of the `boundariesElement`
     */
    padding: 5,
    /**
     * @prop {String|HTMLElement} boundariesElement='viewport'
     * The element which will define the boundaries of the popper position,
     * the popper will never be placed outside of the defined boundaries
     * (except if keepTogether is enabled)
     */
    boundariesElement: 'viewport'
  },

  /**
   * Modifier used to make the popper flow toward the inner of the reference element.
   * By default, when this modifier is disabled, the popper will be placed outside
   * the reference element.
   * @memberof modifiers
   * @inner
   */
  inner: {
    /** @prop {number} order=700 - Index used to define the order of execution */
    order: 700,
    /** @prop {Boolean} enabled=false - Whether the modifier is enabled or not */
    enabled: false,
    /** @prop {ModifierFn} */
    fn: inner
  },

  /**
   * Modifier used to hide the popper when its reference element is outside of the
   * popper boundaries. It will set a `x-out-of-boundaries` attribute which can
   * be used to hide with a CSS selector the popper when its reference is
   * out of boundaries.
   *
   * Requires the `preventOverflow` modifier before it in order to work.
   * @memberof modifiers
   * @inner
   */
  hide: {
    /** @prop {number} order=800 - Index used to define the order of execution */
    order: 800,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: hide
  },

  /**
   * Computes the style that will be applied to the popper element to gets
   * properly positioned.
   *
   * Note that this modifier will not touch the DOM, it just prepares the styles
   * so that `applyStyle` modifier can apply it. This separation is useful
   * in case you need to replace `applyStyle` with a custom implementation.
   *
   * This modifier has `850` as `order` value to maintain backward compatibility
   * with previous versions of Popper.js. Expect the modifiers ordering method
   * to change in future major versions of the library.
   *
   * @memberof modifiers
   * @inner
   */
  computeStyle: {
    /** @prop {number} order=850 - Index used to define the order of execution */
    order: 850,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: computeStyle,
    /**
     * @prop {Boolean} gpuAcceleration=true
     * If true, it uses the CSS 3d transformation to position the popper.
     * Otherwise, it will use the `top` and `left` properties.
     */
    gpuAcceleration: true,
    /**
     * @prop {string} [x='bottom']
     * Where to anchor the X axis (`bottom` or `top`). AKA X offset origin.
     * Change this if your popper should grow in a direction different from `bottom`
     */
    x: 'bottom',
    /**
     * @prop {string} [x='left']
     * Where to anchor the Y axis (`left` or `right`). AKA Y offset origin.
     * Change this if your popper should grow in a direction different from `right`
     */
    y: 'right'
  },

  /**
   * Applies the computed styles to the popper element.
   *
   * All the DOM manipulations are limited to this modifier. This is useful in case
   * you want to integrate Popper.js inside a framework or view library and you
   * want to delegate all the DOM manipulations to it.
   *
   * Note that if you disable this modifier, you must make sure the popper element
   * has its position set to `absolute` before Popper.js can do its work!
   *
   * Just disable this modifier and define you own to achieve the desired effect.
   *
   * @memberof modifiers
   * @inner
   */
  applyStyle: {
    /** @prop {number} order=900 - Index used to define the order of execution */
    order: 900,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: applyStyle,
    /** @prop {Function} */
    onLoad: applyStyleOnLoad,
    /**
     * @deprecated since version 1.10.0, the property moved to `computeStyle` modifier
     * @prop {Boolean} gpuAcceleration=true
     * If true, it uses the CSS 3d transformation to position the popper.
     * Otherwise, it will use the `top` and `left` properties.
     */
    gpuAcceleration: undefined
  }
};

/**
 * The `dataObject` is an object containing all the informations used by Popper.js
 * this object get passed to modifiers and to the `onCreate` and `onUpdate` callbacks.
 * @name dataObject
 * @property {Object} data.instance The Popper.js instance
 * @property {String} data.placement Placement applied to popper
 * @property {String} data.originalPlacement Placement originally defined on init
 * @property {Boolean} data.flipped True if popper has been flipped by flip modifier
 * @property {Boolean} data.hide True if the reference element is out of boundaries, useful to know when to hide the popper.
 * @property {HTMLElement} data.arrowElement Node used as arrow by arrow modifier
 * @property {Object} data.styles Any CSS property defined here will be applied to the popper, it expects the JavaScript nomenclature (eg. `marginBottom`)
 * @property {Object} data.boundaries Offsets of the popper boundaries
 * @property {Object} data.offsets The measurements of popper, reference and arrow elements.
 * @property {Object} data.offsets.popper `top`, `left`, `width`, `height` values
 * @property {Object} data.offsets.reference `top`, `left`, `width`, `height` values
 * @property {Object} data.offsets.arrow] `top` and `left` offsets, only one of them will be different from 0
 */

/**
 * Default options provided to Popper.js constructor.<br />
 * These can be overriden using the `options` argument of Popper.js.<br />
 * To override an option, simply pass as 3rd argument an object with the same
 * structure of this object, example:
 * ```
 * new Popper(ref, pop, {
 *   modifiers: {
 *     preventOverflow: { enabled: false }
 *   }
 * })
 * ```
 * @type {Object}
 * @static
 * @memberof Popper
 */
var Defaults = {
  /**
   * Popper's placement
   * @prop {Popper.placements} placement='bottom'
   */
  placement: 'bottom',

  /**
   * Whether events (resize, scroll) are initially enabled
   * @prop {Boolean} eventsEnabled=true
   */
  eventsEnabled: true,

  /**
   * Set to true if you want to automatically remove the popper when
   * you call the `destroy` method.
   * @prop {Boolean} removeOnDestroy=false
   */
  removeOnDestroy: false,

  /**
   * Callback called when the popper is created.<br />
   * By default, is set to no-op.<br />
   * Access Popper.js instance with `data.instance`.
   * @prop {onCreate}
   */
  onCreate: function onCreate() {},

  /**
   * Callback called when the popper is updated, this callback is not called
   * on the initialization/creation of the popper, but only on subsequent
   * updates.<br />
   * By default, is set to no-op.<br />
   * Access Popper.js instance with `data.instance`.
   * @prop {onUpdate}
   */
  onUpdate: function onUpdate() {},

  /**
   * List of modifiers used to modify the offsets before they are applied to the popper.
   * They provide most of the functionalities of Popper.js
   * @prop {modifiers}
   */
  modifiers: modifiers
};

/**
 * @callback onCreate
 * @param {dataObject} data
 */

/**
 * @callback onUpdate
 * @param {dataObject} data
 */

// Utils
// Methods
var Popper = function () {
  /**
   * Create a new Popper.js instance
   * @class Popper
   * @param {HTMLElement|referenceObject} reference - The reference element used to position the popper
   * @param {HTMLElement} popper - The HTML element used as popper.
   * @param {Object} options - Your custom options to override the ones defined in [Defaults](#defaults)
   * @return {Object} instance - The generated Popper.js instance
   */
  function Popper(reference, popper) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    classCallCheck(this, Popper);

    this.scheduleUpdate = function () {
      return requestAnimationFrame(_this.update);
    };

    // make update() debounced, so that it only runs at most once-per-tick
    this.update = debounce(this.update.bind(this));

    // with {} we create a new object with the options inside it
    this.options = _extends({}, Popper.Defaults, options);

    // init state
    this.state = {
      isDestroyed: false,
      isCreated: false,
      scrollParents: []
    };

    // get reference and popper elements (allow jQuery wrappers)
    this.reference = reference.jquery ? reference[0] : reference;
    this.popper = popper.jquery ? popper[0] : popper;

    // Deep merge modifiers options
    this.options.modifiers = {};
    Object.keys(_extends({}, Popper.Defaults.modifiers, options.modifiers)).forEach(function (name) {
      _this.options.modifiers[name] = _extends({}, Popper.Defaults.modifiers[name] || {}, options.modifiers ? options.modifiers[name] : {});
    });

    // Refactoring modifiers' list (Object => Array)
    this.modifiers = Object.keys(this.options.modifiers).map(function (name) {
      return _extends({
        name: name
      }, _this.options.modifiers[name]);
    })
    // sort the modifiers by order
    .sort(function (a, b) {
      return a.order - b.order;
    });

    // modifiers have the ability to execute arbitrary code when Popper.js get inited
    // such code is executed in the same order of its modifier
    // they could add new properties to their options configuration
    // BE AWARE: don't add options to `options.modifiers.name` but to `modifierOptions`!
    this.modifiers.forEach(function (modifierOptions) {
      if (modifierOptions.enabled && isFunction(modifierOptions.onLoad)) {
        modifierOptions.onLoad(_this.reference, _this.popper, _this.options, modifierOptions, _this.state);
      }
    });

    // fire the first update to position the popper in the right place
    this.update();

    var eventsEnabled = this.options.eventsEnabled;
    if (eventsEnabled) {
      // setup event listeners, they will take care of update the position in specific situations
      this.enableEventListeners();
    }

    this.state.eventsEnabled = eventsEnabled;
  }

  // We can't use class properties because they don't get listed in the
  // class prototype and break stuff like Sinon stubs


  createClass(Popper, [{
    key: 'update',
    value: function update$$1() {
      return update.call(this);
    }
  }, {
    key: 'destroy',
    value: function destroy$$1() {
      return destroy.call(this);
    }
  }, {
    key: 'enableEventListeners',
    value: function enableEventListeners$$1() {
      return enableEventListeners.call(this);
    }
  }, {
    key: 'disableEventListeners',
    value: function disableEventListeners$$1() {
      return disableEventListeners.call(this);
    }

    /**
     * Schedule an update, it will run on the next UI update available
     * @method scheduleUpdate
     * @memberof Popper
     */


    /**
     * Collection of utilities useful when writing custom modifiers.
     * Starting from version 1.7, this method is available only if you
     * include `popper-utils.js` before `popper.js`.
     *
     * **DEPRECATION**: This way to access PopperUtils is deprecated
     * and will be removed in v2! Use the PopperUtils module directly instead.
     * Due to the high instability of the methods contained in Utils, we can't
     * guarantee them to follow semver. Use them at your own risk!
     * @static
     * @private
     * @type {Object}
     * @deprecated since version 1.8
     * @member Utils
     * @memberof Popper
     */

  }]);
  return Popper;
}();

/**
 * The `referenceObject` is an object that provides an interface compatible with Popper.js
 * and lets you use it as replacement of a real DOM node.<br />
 * You can use this method to position a popper relatively to a set of coordinates
 * in case you don't have a DOM node to use as reference.
 *
 * ```
 * new Popper(referenceObject, popperNode);
 * ```
 *
 * NB: This feature isn't supported in Internet Explorer 10
 * @name referenceObject
 * @property {Function} data.getBoundingClientRect
 * A function that returns a set of coordinates compatible with the native `getBoundingClientRect` method.
 * @property {number} data.clientWidth
 * An ES6 getter that will return the width of the virtual reference element.
 * @property {number} data.clientHeight
 * An ES6 getter that will return the height of the virtual reference element.
 */


Popper.Utils = (typeof window !== 'undefined' ? window : global).PopperUtils;
Popper.placements = placements;
Popper.Defaults = Defaults;

return Popper;

})));
//# sourceMappingURL=popper.js.map

/*!
 * Bootstrap v4.0.0-beta (https://getbootstrap.com)
 * Copyright 2011-2017 The Bootstrap Authors (https://github.com/twbs/bootstrap/graphs/contributors)
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery. jQuery must be included before Bootstrap\'s JavaScript.')
}

(function ($) {
  var version = $.fn.jquery.split(' ')[0].split('.')
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1) || (version[0] >= 4)) {
    throw new Error('Bootstrap\'s JavaScript requires at least jQuery v1.9.1 but less than v4.0.0')
  }
})(jQuery);

(function () {
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): util.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Util = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Private TransitionEnd Helpers
   * ------------------------------------------------------------------------
   */

  var transition = false;

  var MAX_UID = 1000000;

  var TransitionEndEvent = {
    WebkitTransition: 'webkitTransitionEnd',
    MozTransition: 'transitionend',
    OTransition: 'oTransitionEnd otransitionend',
    transition: 'transitionend'

    // shoutout AngusCroll (https://goo.gl/pxwQGp)
  };function toType(obj) {
    return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }

  function isElement(obj) {
    return (obj[0] || obj).nodeType;
  }

  function getSpecialTransitionEndEvent() {
    return {
      bindType: transition.end,
      delegateType: transition.end,
      handle: function handle(event) {
        if ($(event.target).is(this)) {
          return event.handleObj.handler.apply(this, arguments); // eslint-disable-line prefer-rest-params
        }
        return undefined;
      }
    };
  }

  function transitionEndTest() {
    if (window.QUnit) {
      return false;
    }

    var el = document.createElement('bootstrap');

    for (var name in TransitionEndEvent) {
      if (el.style[name] !== undefined) {
        return {
          end: TransitionEndEvent[name]
        };
      }
    }

    return false;
  }

  function transitionEndEmulator(duration) {
    var _this = this;

    var called = false;

    $(this).one(Util.TRANSITION_END, function () {
      called = true;
    });

    setTimeout(function () {
      if (!called) {
        Util.triggerTransitionEnd(_this);
      }
    }, duration);

    return this;
  }

  function setTransitionEndSupport() {
    transition = transitionEndTest();

    $.fn.emulateTransitionEnd = transitionEndEmulator;

    if (Util.supportsTransitionEnd()) {
      $.event.special[Util.TRANSITION_END] = getSpecialTransitionEndEvent();
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Public Util Api
   * --------------------------------------------------------------------------
   */

  var Util = {

    TRANSITION_END: 'bsTransitionEnd',

    getUID: function getUID(prefix) {
      do {
        // eslint-disable-next-line no-bitwise
        prefix += ~~(Math.random() * MAX_UID); // "~~" acts like a faster Math.floor() here
      } while (document.getElementById(prefix));
      return prefix;
    },
    getSelectorFromElement: function getSelectorFromElement(element) {
      var selector = element.getAttribute('data-target');
      if (!selector || selector === '#') {
        selector = element.getAttribute('href') || '';
      }

      try {
        var $selector = $(selector);
        return $selector.length > 0 ? selector : null;
      } catch (error) {
        return null;
      }
    },
    reflow: function reflow(element) {
      return element.offsetHeight;
    },
    triggerTransitionEnd: function triggerTransitionEnd(element) {
      $(element).trigger(transition.end);
    },
    supportsTransitionEnd: function supportsTransitionEnd() {
      return Boolean(transition);
    },
    typeCheckConfig: function typeCheckConfig(componentName, config, configTypes) {
      for (var property in configTypes) {
        if (configTypes.hasOwnProperty(property)) {
          var expectedTypes = configTypes[property];
          var value = config[property];
          var valueType = value && isElement(value) ? 'element' : toType(value);

          if (!new RegExp(expectedTypes).test(valueType)) {
            throw new Error(componentName.toUpperCase() + ': ' + ('Option "' + property + '" provided type "' + valueType + '" ') + ('but expected type "' + expectedTypes + '".'));
          }
        }
      }
    }
  };

  setTransitionEndSupport();

  return Util;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): alert.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Alert = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'alert';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.alert';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 150;

  var Selector = {
    DISMISS: '[data-dismiss="alert"]'
  };

  var Event = {
    CLOSE: 'close' + EVENT_KEY,
    CLOSED: 'closed' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    ALERT: 'alert',
    FADE: 'fade',
    SHOW: 'show'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Alert = function () {
    function Alert(element) {
      _classCallCheck(this, Alert);

      this._element = element;
    }

    // getters

    // public

    Alert.prototype.close = function close(element) {
      element = element || this._element;

      var rootElement = this._getRootElement(element);
      var customEvent = this._triggerCloseEvent(rootElement);

      if (customEvent.isDefaultPrevented()) {
        return;
      }

      this._removeElement(rootElement);
    };

    Alert.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      this._element = null;
    };

    // private

    Alert.prototype._getRootElement = function _getRootElement(element) {
      var selector = Util.getSelectorFromElement(element);
      var parent = false;

      if (selector) {
        parent = $(selector)[0];
      }

      if (!parent) {
        parent = $(element).closest('.' + ClassName.ALERT)[0];
      }

      return parent;
    };

    Alert.prototype._triggerCloseEvent = function _triggerCloseEvent(element) {
      var closeEvent = $.Event(Event.CLOSE);

      $(element).trigger(closeEvent);
      return closeEvent;
    };

    Alert.prototype._removeElement = function _removeElement(element) {
      var _this2 = this;

      $(element).removeClass(ClassName.SHOW);

      if (!Util.supportsTransitionEnd() || !$(element).hasClass(ClassName.FADE)) {
        this._destroyElement(element);
        return;
      }

      $(element).one(Util.TRANSITION_END, function (event) {
        return _this2._destroyElement(element, event);
      }).emulateTransitionEnd(TRANSITION_DURATION);
    };

    Alert.prototype._destroyElement = function _destroyElement(element) {
      $(element).detach().trigger(Event.CLOSED).remove();
    };

    // static

    Alert._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var $element = $(this);
        var data = $element.data(DATA_KEY);

        if (!data) {
          data = new Alert(this);
          $element.data(DATA_KEY, data);
        }

        if (config === 'close') {
          data[config](this);
        }
      });
    };

    Alert._handleDismiss = function _handleDismiss(alertInstance) {
      return function (event) {
        if (event) {
          event.preventDefault();
        }

        alertInstance.close(this);
      };
    };

    _createClass(Alert, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }]);

    return Alert;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DISMISS, Alert._handleDismiss(new Alert()));

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Alert._jQueryInterface;
  $.fn[NAME].Constructor = Alert;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Alert._jQueryInterface;
  };

  return Alert;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): button.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Button = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'button';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.button';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];

  var ClassName = {
    ACTIVE: 'active',
    BUTTON: 'btn',
    FOCUS: 'focus'
  };

  var Selector = {
    DATA_TOGGLE_CARROT: '[data-toggle^="button"]',
    DATA_TOGGLE: '[data-toggle="buttons"]',
    INPUT: 'input',
    ACTIVE: '.active',
    BUTTON: '.btn'
  };

  var Event = {
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY,
    FOCUS_BLUR_DATA_API: 'focus' + EVENT_KEY + DATA_API_KEY + ' ' + ('blur' + EVENT_KEY + DATA_API_KEY)

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Button = function () {
    function Button(element) {
      _classCallCheck(this, Button);

      this._element = element;
    }

    // getters

    // public

    Button.prototype.toggle = function toggle() {
      var triggerChangeEvent = true;
      var addAriaPressed = true;
      var rootElement = $(this._element).closest(Selector.DATA_TOGGLE)[0];

      if (rootElement) {
        var input = $(this._element).find(Selector.INPUT)[0];

        if (input) {
          if (input.type === 'radio') {
            if (input.checked && $(this._element).hasClass(ClassName.ACTIVE)) {
              triggerChangeEvent = false;
            } else {
              var activeElement = $(rootElement).find(Selector.ACTIVE)[0];

              if (activeElement) {
                $(activeElement).removeClass(ClassName.ACTIVE);
              }
            }
          }

          if (triggerChangeEvent) {
            if (input.hasAttribute('disabled') || rootElement.hasAttribute('disabled') || input.classList.contains('disabled') || rootElement.classList.contains('disabled')) {
              return;
            }
            input.checked = !$(this._element).hasClass(ClassName.ACTIVE);
            $(input).trigger('change');
          }

          input.focus();
          addAriaPressed = false;
        }
      }

      if (addAriaPressed) {
        this._element.setAttribute('aria-pressed', !$(this._element).hasClass(ClassName.ACTIVE));
      }

      if (triggerChangeEvent) {
        $(this._element).toggleClass(ClassName.ACTIVE);
      }
    };

    Button.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      this._element = null;
    };

    // static

    Button._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);

        if (!data) {
          data = new Button(this);
          $(this).data(DATA_KEY, data);
        }

        if (config === 'toggle') {
          data[config]();
        }
      });
    };

    _createClass(Button, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }]);

    return Button;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE_CARROT, function (event) {
    event.preventDefault();

    var button = event.target;

    if (!$(button).hasClass(ClassName.BUTTON)) {
      button = $(button).closest(Selector.BUTTON);
    }

    Button._jQueryInterface.call($(button), 'toggle');
  }).on(Event.FOCUS_BLUR_DATA_API, Selector.DATA_TOGGLE_CARROT, function (event) {
    var button = $(event.target).closest(Selector.BUTTON)[0];
    $(button).toggleClass(ClassName.FOCUS, /^focus(in)?$/.test(event.type));
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Button._jQueryInterface;
  $.fn[NAME].Constructor = Button;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Button._jQueryInterface;
  };

  return Button;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): carousel.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Carousel = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'carousel';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.carousel';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 600;
  var ARROW_LEFT_KEYCODE = 37; // KeyboardEvent.which value for left arrow key
  var ARROW_RIGHT_KEYCODE = 39; // KeyboardEvent.which value for right arrow key
  var TOUCHEVENT_COMPAT_WAIT = 500; // Time for mouse compat events to fire after touch

  var Default = {
    interval: 5000,
    keyboard: true,
    slide: false,
    pause: 'hover',
    wrap: true
  };

  var DefaultType = {
    interval: '(number|boolean)',
    keyboard: 'boolean',
    slide: '(boolean|string)',
    pause: '(string|boolean)',
    wrap: 'boolean'
  };

  var Direction = {
    NEXT: 'next',
    PREV: 'prev',
    LEFT: 'left',
    RIGHT: 'right'
  };

  var Event = {
    SLIDE: 'slide' + EVENT_KEY,
    SLID: 'slid' + EVENT_KEY,
    KEYDOWN: 'keydown' + EVENT_KEY,
    MOUSEENTER: 'mouseenter' + EVENT_KEY,
    MOUSELEAVE: 'mouseleave' + EVENT_KEY,
    TOUCHEND: 'touchend' + EVENT_KEY,
    LOAD_DATA_API: 'load' + EVENT_KEY + DATA_API_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    CAROUSEL: 'carousel',
    ACTIVE: 'active',
    SLIDE: 'slide',
    RIGHT: 'carousel-item-right',
    LEFT: 'carousel-item-left',
    NEXT: 'carousel-item-next',
    PREV: 'carousel-item-prev',
    ITEM: 'carousel-item'
  };

  var Selector = {
    ACTIVE: '.active',
    ACTIVE_ITEM: '.active.carousel-item',
    ITEM: '.carousel-item',
    NEXT_PREV: '.carousel-item-next, .carousel-item-prev',
    INDICATORS: '.carousel-indicators',
    DATA_SLIDE: '[data-slide], [data-slide-to]',
    DATA_RIDE: '[data-ride="carousel"]'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Carousel = function () {
    function Carousel(element, config) {
      _classCallCheck(this, Carousel);

      this._items = null;
      this._interval = null;
      this._activeElement = null;

      this._isPaused = false;
      this._isSliding = false;

      this.touchTimeout = null;

      this._config = this._getConfig(config);
      this._element = $(element)[0];
      this._indicatorsElement = $(this._element).find(Selector.INDICATORS)[0];

      this._addEventListeners();
    }

    // getters

    // public

    Carousel.prototype.next = function next() {
      if (!this._isSliding) {
        this._slide(Direction.NEXT);
      }
    };

    Carousel.prototype.nextWhenVisible = function nextWhenVisible() {
      // Don't call next when the page isn't visible
      if (!document.hidden) {
        this.next();
      }
    };

    Carousel.prototype.prev = function prev() {
      if (!this._isSliding) {
        this._slide(Direction.PREV);
      }
    };

    Carousel.prototype.pause = function pause(event) {
      if (!event) {
        this._isPaused = true;
      }

      if ($(this._element).find(Selector.NEXT_PREV)[0] && Util.supportsTransitionEnd()) {
        Util.triggerTransitionEnd(this._element);
        this.cycle(true);
      }

      clearInterval(this._interval);
      this._interval = null;
    };

    Carousel.prototype.cycle = function cycle(event) {
      if (!event) {
        this._isPaused = false;
      }

      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }

      if (this._config.interval && !this._isPaused) {
        this._interval = setInterval((document.visibilityState ? this.nextWhenVisible : this.next).bind(this), this._config.interval);
      }
    };

    Carousel.prototype.to = function to(index) {
      var _this3 = this;

      this._activeElement = $(this._element).find(Selector.ACTIVE_ITEM)[0];

      var activeIndex = this._getItemIndex(this._activeElement);

      if (index > this._items.length - 1 || index < 0) {
        return;
      }

      if (this._isSliding) {
        $(this._element).one(Event.SLID, function () {
          return _this3.to(index);
        });
        return;
      }

      if (activeIndex === index) {
        this.pause();
        this.cycle();
        return;
      }

      var direction = index > activeIndex ? Direction.NEXT : Direction.PREV;

      this._slide(direction, this._items[index]);
    };

    Carousel.prototype.dispose = function dispose() {
      $(this._element).off(EVENT_KEY);
      $.removeData(this._element, DATA_KEY);

      this._items = null;
      this._config = null;
      this._element = null;
      this._interval = null;
      this._isPaused = null;
      this._isSliding = null;
      this._activeElement = null;
      this._indicatorsElement = null;
    };

    // private

    Carousel.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, Default, config);
      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    Carousel.prototype._addEventListeners = function _addEventListeners() {
      var _this4 = this;

      if (this._config.keyboard) {
        $(this._element).on(Event.KEYDOWN, function (event) {
          return _this4._keydown(event);
        });
      }

      if (this._config.pause === 'hover') {
        $(this._element).on(Event.MOUSEENTER, function (event) {
          return _this4.pause(event);
        }).on(Event.MOUSELEAVE, function (event) {
          return _this4.cycle(event);
        });
        if ('ontouchstart' in document.documentElement) {
          // if it's a touch-enabled device, mouseenter/leave are fired as
          // part of the mouse compatibility events on first tap - the carousel
          // would stop cycling until user tapped out of it;
          // here, we listen for touchend, explicitly pause the carousel
          // (as if it's the second time we tap on it, mouseenter compat event
          // is NOT fired) and after a timeout (to allow for mouse compatibility
          // events to fire) we explicitly restart cycling
          $(this._element).on(Event.TOUCHEND, function () {
            _this4.pause();
            if (_this4.touchTimeout) {
              clearTimeout(_this4.touchTimeout);
            }
            _this4.touchTimeout = setTimeout(function (event) {
              return _this4.cycle(event);
            }, TOUCHEVENT_COMPAT_WAIT + _this4._config.interval);
          });
        }
      }
    };

    Carousel.prototype._keydown = function _keydown(event) {
      if (/input|textarea/i.test(event.target.tagName)) {
        return;
      }

      switch (event.which) {
        case ARROW_LEFT_KEYCODE:
          event.preventDefault();
          this.prev();
          break;
        case ARROW_RIGHT_KEYCODE:
          event.preventDefault();
          this.next();
          break;
        default:
          return;
      }
    };

    Carousel.prototype._getItemIndex = function _getItemIndex(element) {
      this._items = $.makeArray($(element).parent().find(Selector.ITEM));
      return this._items.indexOf(element);
    };

    Carousel.prototype._getItemByDirection = function _getItemByDirection(direction, activeElement) {
      var isNextDirection = direction === Direction.NEXT;
      var isPrevDirection = direction === Direction.PREV;
      var activeIndex = this._getItemIndex(activeElement);
      var lastItemIndex = this._items.length - 1;
      var isGoingToWrap = isPrevDirection && activeIndex === 0 || isNextDirection && activeIndex === lastItemIndex;

      if (isGoingToWrap && !this._config.wrap) {
        return activeElement;
      }

      var delta = direction === Direction.PREV ? -1 : 1;
      var itemIndex = (activeIndex + delta) % this._items.length;

      return itemIndex === -1 ? this._items[this._items.length - 1] : this._items[itemIndex];
    };

    Carousel.prototype._triggerSlideEvent = function _triggerSlideEvent(relatedTarget, eventDirectionName) {
      var targetIndex = this._getItemIndex(relatedTarget);
      var fromIndex = this._getItemIndex($(this._element).find(Selector.ACTIVE_ITEM)[0]);
      var slideEvent = $.Event(Event.SLIDE, {
        relatedTarget: relatedTarget,
        direction: eventDirectionName,
        from: fromIndex,
        to: targetIndex
      });

      $(this._element).trigger(slideEvent);

      return slideEvent;
    };

    Carousel.prototype._setActiveIndicatorElement = function _setActiveIndicatorElement(element) {
      if (this._indicatorsElement) {
        $(this._indicatorsElement).find(Selector.ACTIVE).removeClass(ClassName.ACTIVE);

        var nextIndicator = this._indicatorsElement.children[this._getItemIndex(element)];

        if (nextIndicator) {
          $(nextIndicator).addClass(ClassName.ACTIVE);
        }
      }
    };

    Carousel.prototype._slide = function _slide(direction, element) {
      var _this5 = this;

      var activeElement = $(this._element).find(Selector.ACTIVE_ITEM)[0];
      var activeElementIndex = this._getItemIndex(activeElement);
      var nextElement = element || activeElement && this._getItemByDirection(direction, activeElement);
      var nextElementIndex = this._getItemIndex(nextElement);
      var isCycling = Boolean(this._interval);

      var directionalClassName = void 0;
      var orderClassName = void 0;
      var eventDirectionName = void 0;

      if (direction === Direction.NEXT) {
        directionalClassName = ClassName.LEFT;
        orderClassName = ClassName.NEXT;
        eventDirectionName = Direction.LEFT;
      } else {
        directionalClassName = ClassName.RIGHT;
        orderClassName = ClassName.PREV;
        eventDirectionName = Direction.RIGHT;
      }

      if (nextElement && $(nextElement).hasClass(ClassName.ACTIVE)) {
        this._isSliding = false;
        return;
      }

      var slideEvent = this._triggerSlideEvent(nextElement, eventDirectionName);
      if (slideEvent.isDefaultPrevented()) {
        return;
      }

      if (!activeElement || !nextElement) {
        // some weirdness is happening, so we bail
        return;
      }

      this._isSliding = true;

      if (isCycling) {
        this.pause();
      }

      this._setActiveIndicatorElement(nextElement);

      var slidEvent = $.Event(Event.SLID, {
        relatedTarget: nextElement,
        direction: eventDirectionName,
        from: activeElementIndex,
        to: nextElementIndex
      });

      if (Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.SLIDE)) {

        $(nextElement).addClass(orderClassName);

        Util.reflow(nextElement);

        $(activeElement).addClass(directionalClassName);
        $(nextElement).addClass(directionalClassName);

        $(activeElement).one(Util.TRANSITION_END, function () {
          $(nextElement).removeClass(directionalClassName + ' ' + orderClassName).addClass(ClassName.ACTIVE);

          $(activeElement).removeClass(ClassName.ACTIVE + ' ' + orderClassName + ' ' + directionalClassName);

          _this5._isSliding = false;

          setTimeout(function () {
            return $(_this5._element).trigger(slidEvent);
          }, 0);
        }).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        $(activeElement).removeClass(ClassName.ACTIVE);
        $(nextElement).addClass(ClassName.ACTIVE);

        this._isSliding = false;
        $(this._element).trigger(slidEvent);
      }

      if (isCycling) {
        this.cycle();
      }
    };

    // static

    Carousel._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = $.extend({}, Default, $(this).data());

        if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object') {
          $.extend(_config, config);
        }

        var action = typeof config === 'string' ? config : _config.slide;

        if (!data) {
          data = new Carousel(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'number') {
          data.to(config);
        } else if (typeof action === 'string') {
          if (data[action] === undefined) {
            throw new Error('No method named "' + action + '"');
          }
          data[action]();
        } else if (_config.interval) {
          data.pause();
          data.cycle();
        }
      });
    };

    Carousel._dataApiClickHandler = function _dataApiClickHandler(event) {
      var selector = Util.getSelectorFromElement(this);

      if (!selector) {
        return;
      }

      var target = $(selector)[0];

      if (!target || !$(target).hasClass(ClassName.CAROUSEL)) {
        return;
      }

      var config = $.extend({}, $(target).data(), $(this).data());
      var slideIndex = this.getAttribute('data-slide-to');

      if (slideIndex) {
        config.interval = false;
      }

      Carousel._jQueryInterface.call($(target), config);

      if (slideIndex) {
        $(target).data(DATA_KEY).to(slideIndex);
      }

      event.preventDefault();
    };

    _createClass(Carousel, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }]);

    return Carousel;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_SLIDE, Carousel._dataApiClickHandler);

  $(window).on(Event.LOAD_DATA_API, function () {
    $(Selector.DATA_RIDE).each(function () {
      var $carousel = $(this);
      Carousel._jQueryInterface.call($carousel, $carousel.data());
    });
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Carousel._jQueryInterface;
  $.fn[NAME].Constructor = Carousel;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Carousel._jQueryInterface;
  };

  return Carousel;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): collapse.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Collapse = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'collapse';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.collapse';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 600;

  var Default = {
    toggle: true,
    parent: ''
  };

  var DefaultType = {
    toggle: 'boolean',
    parent: 'string'
  };

  var Event = {
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    SHOW: 'show',
    COLLAPSE: 'collapse',
    COLLAPSING: 'collapsing',
    COLLAPSED: 'collapsed'
  };

  var Dimension = {
    WIDTH: 'width',
    HEIGHT: 'height'
  };

  var Selector = {
    ACTIVES: '.show, .collapsing',
    DATA_TOGGLE: '[data-toggle="collapse"]'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Collapse = function () {
    function Collapse(element, config) {
      _classCallCheck(this, Collapse);

      this._isTransitioning = false;
      this._element = element;
      this._config = this._getConfig(config);
      this._triggerArray = $.makeArray($('[data-toggle="collapse"][href="#' + element.id + '"],' + ('[data-toggle="collapse"][data-target="#' + element.id + '"]')));
      var tabToggles = $(Selector.DATA_TOGGLE);
      for (var i = 0; i < tabToggles.length; i++) {
        var elem = tabToggles[i];
        var selector = Util.getSelectorFromElement(elem);
        if (selector !== null && $(selector).filter(element).length > 0) {
          this._triggerArray.push(elem);
        }
      }

      this._parent = this._config.parent ? this._getParent() : null;

      if (!this._config.parent) {
        this._addAriaAndCollapsedClass(this._element, this._triggerArray);
      }

      if (this._config.toggle) {
        this.toggle();
      }
    }

    // getters

    // public

    Collapse.prototype.toggle = function toggle() {
      if ($(this._element).hasClass(ClassName.SHOW)) {
        this.hide();
      } else {
        this.show();
      }
    };

    Collapse.prototype.show = function show() {
      var _this6 = this;

      if (this._isTransitioning || $(this._element).hasClass(ClassName.SHOW)) {
        return;
      }

      var actives = void 0;
      var activesData = void 0;

      if (this._parent) {
        actives = $.makeArray($(this._parent).children().children(Selector.ACTIVES));
        if (!actives.length) {
          actives = null;
        }
      }

      if (actives) {
        activesData = $(actives).data(DATA_KEY);
        if (activesData && activesData._isTransitioning) {
          return;
        }
      }

      var startEvent = $.Event(Event.SHOW);
      $(this._element).trigger(startEvent);
      if (startEvent.isDefaultPrevented()) {
        return;
      }

      if (actives) {
        Collapse._jQueryInterface.call($(actives), 'hide');
        if (!activesData) {
          $(actives).data(DATA_KEY, null);
        }
      }

      var dimension = this._getDimension();

      $(this._element).removeClass(ClassName.COLLAPSE).addClass(ClassName.COLLAPSING);

      this._element.style[dimension] = 0;

      if (this._triggerArray.length) {
        $(this._triggerArray).removeClass(ClassName.COLLAPSED).attr('aria-expanded', true);
      }

      this.setTransitioning(true);

      var complete = function complete() {
        $(_this6._element).removeClass(ClassName.COLLAPSING).addClass(ClassName.COLLAPSE).addClass(ClassName.SHOW);

        _this6._element.style[dimension] = '';

        _this6.setTransitioning(false);

        $(_this6._element).trigger(Event.SHOWN);
      };

      if (!Util.supportsTransitionEnd()) {
        complete();
        return;
      }

      var capitalizedDimension = dimension[0].toUpperCase() + dimension.slice(1);
      var scrollSize = 'scroll' + capitalizedDimension;

      $(this._element).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);

      this._element.style[dimension] = this._element[scrollSize] + 'px';
    };

    Collapse.prototype.hide = function hide() {
      var _this7 = this;

      if (this._isTransitioning || !$(this._element).hasClass(ClassName.SHOW)) {
        return;
      }

      var startEvent = $.Event(Event.HIDE);
      $(this._element).trigger(startEvent);
      if (startEvent.isDefaultPrevented()) {
        return;
      }

      var dimension = this._getDimension();

      this._element.style[dimension] = this._element.getBoundingClientRect()[dimension] + 'px';

      Util.reflow(this._element);

      $(this._element).addClass(ClassName.COLLAPSING).removeClass(ClassName.COLLAPSE).removeClass(ClassName.SHOW);

      if (this._triggerArray.length) {
        for (var i = 0; i < this._triggerArray.length; i++) {
          var trigger = this._triggerArray[i];
          var selector = Util.getSelectorFromElement(trigger);
          if (selector !== null) {
            var $elem = $(selector);
            if (!$elem.hasClass(ClassName.SHOW)) {
              $(trigger).addClass(ClassName.COLLAPSED).attr('aria-expanded', false);
            }
          }
        }
      }

      this.setTransitioning(true);

      var complete = function complete() {
        _this7.setTransitioning(false);
        $(_this7._element).removeClass(ClassName.COLLAPSING).addClass(ClassName.COLLAPSE).trigger(Event.HIDDEN);
      };

      this._element.style[dimension] = '';

      if (!Util.supportsTransitionEnd()) {
        complete();
        return;
      }

      $(this._element).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
    };

    Collapse.prototype.setTransitioning = function setTransitioning(isTransitioning) {
      this._isTransitioning = isTransitioning;
    };

    Collapse.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);

      this._config = null;
      this._parent = null;
      this._element = null;
      this._triggerArray = null;
      this._isTransitioning = null;
    };

    // private

    Collapse.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, Default, config);
      config.toggle = Boolean(config.toggle); // coerce string values
      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    Collapse.prototype._getDimension = function _getDimension() {
      var hasWidth = $(this._element).hasClass(Dimension.WIDTH);
      return hasWidth ? Dimension.WIDTH : Dimension.HEIGHT;
    };

    Collapse.prototype._getParent = function _getParent() {
      var _this8 = this;

      var parent = $(this._config.parent)[0];
      var selector = '[data-toggle="collapse"][data-parent="' + this._config.parent + '"]';

      $(parent).find(selector).each(function (i, element) {
        _this8._addAriaAndCollapsedClass(Collapse._getTargetFromElement(element), [element]);
      });

      return parent;
    };

    Collapse.prototype._addAriaAndCollapsedClass = function _addAriaAndCollapsedClass(element, triggerArray) {
      if (element) {
        var isOpen = $(element).hasClass(ClassName.SHOW);

        if (triggerArray.length) {
          $(triggerArray).toggleClass(ClassName.COLLAPSED, !isOpen).attr('aria-expanded', isOpen);
        }
      }
    };

    // static

    Collapse._getTargetFromElement = function _getTargetFromElement(element) {
      var selector = Util.getSelectorFromElement(element);
      return selector ? $(selector)[0] : null;
    };

    Collapse._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var $this = $(this);
        var data = $this.data(DATA_KEY);
        var _config = $.extend({}, Default, $this.data(), (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config);

        if (!data && _config.toggle && /show|hide/.test(config)) {
          _config.toggle = false;
        }

        if (!data) {
          data = new Collapse(this, _config);
          $this.data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(Collapse, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }]);

    return Collapse;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    if (!/input|textarea/i.test(event.target.tagName)) {
      event.preventDefault();
    }

    var $trigger = $(this);
    var selector = Util.getSelectorFromElement(this);
    $(selector).each(function () {
      var $target = $(this);
      var data = $target.data(DATA_KEY);
      var config = data ? 'toggle' : $trigger.data();
      Collapse._jQueryInterface.call($target, config);
    });
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Collapse._jQueryInterface;
  $.fn[NAME].Constructor = Collapse;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Collapse._jQueryInterface;
  };

  return Collapse;
}(jQuery);

/* global Popper */

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): dropdown.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Dropdown = function ($) {

  /**
   * Check for Popper dependency
   * Popper - https://popper.js.org
   */
  if (typeof Popper === 'undefined') {
    throw new Error('Bootstrap dropdown require Popper.js (https://popper.js.org)');
  }

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'dropdown';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.dropdown';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var ESCAPE_KEYCODE = 27; // KeyboardEvent.which value for Escape (Esc) key
  var SPACE_KEYCODE = 32; // KeyboardEvent.which value for space key
  var TAB_KEYCODE = 9; // KeyboardEvent.which value for tab key
  var ARROW_UP_KEYCODE = 38; // KeyboardEvent.which value for up arrow key
  var ARROW_DOWN_KEYCODE = 40; // KeyboardEvent.which value for down arrow key
  var RIGHT_MOUSE_BUTTON_WHICH = 3; // MouseEvent.which value for the right button (assuming a right-handed mouse)
  var REGEXP_KEYDOWN = new RegExp(ARROW_UP_KEYCODE + '|' + ARROW_DOWN_KEYCODE + '|' + ESCAPE_KEYCODE);

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    CLICK: 'click' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY,
    KEYDOWN_DATA_API: 'keydown' + EVENT_KEY + DATA_API_KEY,
    KEYUP_DATA_API: 'keyup' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    DISABLED: 'disabled',
    SHOW: 'show',
    DROPUP: 'dropup',
    MENURIGHT: 'dropdown-menu-right',
    MENULEFT: 'dropdown-menu-left'
  };

  var Selector = {
    DATA_TOGGLE: '[data-toggle="dropdown"]',
    FORM_CHILD: '.dropdown form',
    MENU: '.dropdown-menu',
    NAVBAR_NAV: '.navbar-nav',
    VISIBLE_ITEMS: '.dropdown-menu .dropdown-item:not(.disabled)'
  };

  var AttachmentMap = {
    TOP: 'top-start',
    TOPEND: 'top-end',
    BOTTOM: 'bottom-start',
    BOTTOMEND: 'bottom-end'
  };

  var Default = {
    placement: AttachmentMap.BOTTOM,
    offset: 0,
    flip: true
  };

  var DefaultType = {
    placement: 'string',
    offset: '(number|string)',
    flip: 'boolean'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Dropdown = function () {
    function Dropdown(element, config) {
      _classCallCheck(this, Dropdown);

      this._element = element;
      this._popper = null;
      this._config = this._getConfig(config);
      this._menu = this._getMenuElement();
      this._inNavbar = this._detectNavbar();

      this._addEventListeners();
    }

    // getters

    // public

    Dropdown.prototype.toggle = function toggle() {
      if (this._element.disabled || $(this._element).hasClass(ClassName.DISABLED)) {
        return;
      }

      var parent = Dropdown._getParentFromElement(this._element);
      var isActive = $(this._menu).hasClass(ClassName.SHOW);

      Dropdown._clearMenus();

      if (isActive) {
        return;
      }

      var relatedTarget = {
        relatedTarget: this._element
      };
      var showEvent = $.Event(Event.SHOW, relatedTarget);

      $(parent).trigger(showEvent);

      if (showEvent.isDefaultPrevented()) {
        return;
      }

      var element = this._element;
      // for dropup with alignment we use the parent as popper container
      if ($(parent).hasClass(ClassName.DROPUP)) {
        if ($(this._menu).hasClass(ClassName.MENULEFT) || $(this._menu).hasClass(ClassName.MENURIGHT)) {
          element = parent;
        }
      }
      this._popper = new Popper(element, this._menu, this._getPopperConfig());

      // if this is a touch-enabled device we add extra
      // empty mouseover listeners to the body's immediate children;
      // only needed because of broken event delegation on iOS
      // https://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html
      if ('ontouchstart' in document.documentElement && !$(parent).closest(Selector.NAVBAR_NAV).length) {
        $('body').children().on('mouseover', null, $.noop);
      }

      this._element.focus();
      this._element.setAttribute('aria-expanded', true);

      $(this._menu).toggleClass(ClassName.SHOW);
      $(parent).toggleClass(ClassName.SHOW).trigger($.Event(Event.SHOWN, relatedTarget));
    };

    Dropdown.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      $(this._element).off(EVENT_KEY);
      this._element = null;
      this._menu = null;
      if (this._popper !== null) {
        this._popper.destroy();
      }
      this._popper = null;
    };

    Dropdown.prototype.update = function update() {
      this._inNavbar = this._detectNavbar();
      if (this._popper !== null) {
        this._popper.scheduleUpdate();
      }
    };

    // private

    Dropdown.prototype._addEventListeners = function _addEventListeners() {
      var _this9 = this;

      $(this._element).on(Event.CLICK, function (event) {
        event.preventDefault();
        event.stopPropagation();
        _this9.toggle();
      });
    };

    Dropdown.prototype._getConfig = function _getConfig(config) {
      var elementData = $(this._element).data();
      if (elementData.placement !== undefined) {
        elementData.placement = AttachmentMap[elementData.placement.toUpperCase()];
      }

      config = $.extend({}, this.constructor.Default, $(this._element).data(), config);

      Util.typeCheckConfig(NAME, config, this.constructor.DefaultType);

      return config;
    };

    Dropdown.prototype._getMenuElement = function _getMenuElement() {
      if (!this._menu) {
        var parent = Dropdown._getParentFromElement(this._element);
        this._menu = $(parent).find(Selector.MENU)[0];
      }
      return this._menu;
    };

    Dropdown.prototype._getPlacement = function _getPlacement() {
      var $parentDropdown = $(this._element).parent();
      var placement = this._config.placement;

      // Handle dropup
      if ($parentDropdown.hasClass(ClassName.DROPUP) || this._config.placement === AttachmentMap.TOP) {
        placement = AttachmentMap.TOP;
        if ($(this._menu).hasClass(ClassName.MENURIGHT)) {
          placement = AttachmentMap.TOPEND;
        }
      } else if ($(this._menu).hasClass(ClassName.MENURIGHT)) {
        placement = AttachmentMap.BOTTOMEND;
      }
      return placement;
    };

    Dropdown.prototype._detectNavbar = function _detectNavbar() {
      return $(this._element).closest('.navbar').length > 0;
    };

    Dropdown.prototype._getPopperConfig = function _getPopperConfig() {
      var popperConfig = {
        placement: this._getPlacement(),
        modifiers: {
          offset: {
            offset: this._config.offset
          },
          flip: {
            enabled: this._config.flip
          }
        }

        // Disable Popper.js for Dropdown in Navbar
      };if (this._inNavbar) {
        popperConfig.modifiers.applyStyle = {
          enabled: !this._inNavbar
        };
      }
      return popperConfig;
    };

    // static

    Dropdown._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' ? config : null;

        if (!data) {
          data = new Dropdown(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    Dropdown._clearMenus = function _clearMenus(event) {
      if (event && (event.which === RIGHT_MOUSE_BUTTON_WHICH || event.type === 'keyup' && event.which !== TAB_KEYCODE)) {
        return;
      }

      var toggles = $.makeArray($(Selector.DATA_TOGGLE));
      for (var i = 0; i < toggles.length; i++) {
        var parent = Dropdown._getParentFromElement(toggles[i]);
        var context = $(toggles[i]).data(DATA_KEY);
        var relatedTarget = {
          relatedTarget: toggles[i]
        };

        if (!context) {
          continue;
        }

        var dropdownMenu = context._menu;
        if (!$(parent).hasClass(ClassName.SHOW)) {
          continue;
        }

        if (event && (event.type === 'click' && /input|textarea/i.test(event.target.tagName) || event.type === 'keyup' && event.which === TAB_KEYCODE) && $.contains(parent, event.target)) {
          continue;
        }

        var hideEvent = $.Event(Event.HIDE, relatedTarget);
        $(parent).trigger(hideEvent);
        if (hideEvent.isDefaultPrevented()) {
          continue;
        }

        // if this is a touch-enabled device we remove the extra
        // empty mouseover listeners we added for iOS support
        if ('ontouchstart' in document.documentElement) {
          $('body').children().off('mouseover', null, $.noop);
        }

        toggles[i].setAttribute('aria-expanded', 'false');

        $(dropdownMenu).removeClass(ClassName.SHOW);
        $(parent).removeClass(ClassName.SHOW).trigger($.Event(Event.HIDDEN, relatedTarget));
      }
    };

    Dropdown._getParentFromElement = function _getParentFromElement(element) {
      var parent = void 0;
      var selector = Util.getSelectorFromElement(element);

      if (selector) {
        parent = $(selector)[0];
      }

      return parent || element.parentNode;
    };

    Dropdown._dataApiKeydownHandler = function _dataApiKeydownHandler(event) {
      if (!REGEXP_KEYDOWN.test(event.which) || /button/i.test(event.target.tagName) && event.which === SPACE_KEYCODE || /input|textarea/i.test(event.target.tagName)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (this.disabled || $(this).hasClass(ClassName.DISABLED)) {
        return;
      }

      var parent = Dropdown._getParentFromElement(this);
      var isActive = $(parent).hasClass(ClassName.SHOW);

      if (!isActive && (event.which !== ESCAPE_KEYCODE || event.which !== SPACE_KEYCODE) || isActive && (event.which === ESCAPE_KEYCODE || event.which === SPACE_KEYCODE)) {

        if (event.which === ESCAPE_KEYCODE) {
          var toggle = $(parent).find(Selector.DATA_TOGGLE)[0];
          $(toggle).trigger('focus');
        }

        $(this).trigger('click');
        return;
      }

      var items = $(parent).find(Selector.VISIBLE_ITEMS).get();

      if (!items.length) {
        return;
      }

      var index = items.indexOf(event.target);

      if (event.which === ARROW_UP_KEYCODE && index > 0) {
        // up
        index--;
      }

      if (event.which === ARROW_DOWN_KEYCODE && index < items.length - 1) {
        // down
        index++;
      }

      if (index < 0) {
        index = 0;
      }

      items[index].focus();
    };

    _createClass(Dropdown, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }, {
      key: 'DefaultType',
      get: function get() {
        return DefaultType;
      }
    }]);

    return Dropdown;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.KEYDOWN_DATA_API, Selector.DATA_TOGGLE, Dropdown._dataApiKeydownHandler).on(Event.KEYDOWN_DATA_API, Selector.MENU, Dropdown._dataApiKeydownHandler).on(Event.CLICK_DATA_API + ' ' + Event.KEYUP_DATA_API, Dropdown._clearMenus).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    event.preventDefault();
    event.stopPropagation();
    Dropdown._jQueryInterface.call($(this), 'toggle');
  }).on(Event.CLICK_DATA_API, Selector.FORM_CHILD, function (e) {
    e.stopPropagation();
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Dropdown._jQueryInterface;
  $.fn[NAME].Constructor = Dropdown;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Dropdown._jQueryInterface;
  };

  return Dropdown;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): modal.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Modal = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'modal';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.modal';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 300;
  var BACKDROP_TRANSITION_DURATION = 150;
  var ESCAPE_KEYCODE = 27; // KeyboardEvent.which value for Escape (Esc) key

  var Default = {
    backdrop: true,
    keyboard: true,
    focus: true,
    show: true
  };

  var DefaultType = {
    backdrop: '(boolean|string)',
    keyboard: 'boolean',
    focus: 'boolean',
    show: 'boolean'
  };

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    FOCUSIN: 'focusin' + EVENT_KEY,
    RESIZE: 'resize' + EVENT_KEY,
    CLICK_DISMISS: 'click.dismiss' + EVENT_KEY,
    KEYDOWN_DISMISS: 'keydown.dismiss' + EVENT_KEY,
    MOUSEUP_DISMISS: 'mouseup.dismiss' + EVENT_KEY,
    MOUSEDOWN_DISMISS: 'mousedown.dismiss' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    SCROLLBAR_MEASURER: 'modal-scrollbar-measure',
    BACKDROP: 'modal-backdrop',
    OPEN: 'modal-open',
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    DIALOG: '.modal-dialog',
    DATA_TOGGLE: '[data-toggle="modal"]',
    DATA_DISMISS: '[data-dismiss="modal"]',
    FIXED_CONTENT: '.fixed-top, .fixed-bottom, .is-fixed, .sticky-top',
    NAVBAR_TOGGLER: '.navbar-toggler'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Modal = function () {
    function Modal(element, config) {
      _classCallCheck(this, Modal);

      this._config = this._getConfig(config);
      this._element = element;
      this._dialog = $(element).find(Selector.DIALOG)[0];
      this._backdrop = null;
      this._isShown = false;
      this._isBodyOverflowing = false;
      this._ignoreBackdropClick = false;
      this._originalBodyPadding = 0;
      this._scrollbarWidth = 0;
    }

    // getters

    // public

    Modal.prototype.toggle = function toggle(relatedTarget) {
      return this._isShown ? this.hide() : this.show(relatedTarget);
    };

    Modal.prototype.show = function show(relatedTarget) {
      var _this10 = this;

      if (this._isTransitioning) {
        return;
      }

      if (Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE)) {
        this._isTransitioning = true;
      }

      var showEvent = $.Event(Event.SHOW, {
        relatedTarget: relatedTarget
      });

      $(this._element).trigger(showEvent);

      if (this._isShown || showEvent.isDefaultPrevented()) {
        return;
      }

      this._isShown = true;

      this._checkScrollbar();
      this._setScrollbar();

      $(document.body).addClass(ClassName.OPEN);

      this._setEscapeEvent();
      this._setResizeEvent();

      $(this._element).on(Event.CLICK_DISMISS, Selector.DATA_DISMISS, function (event) {
        return _this10.hide(event);
      });

      $(this._dialog).on(Event.MOUSEDOWN_DISMISS, function () {
        $(_this10._element).one(Event.MOUSEUP_DISMISS, function (event) {
          if ($(event.target).is(_this10._element)) {
            _this10._ignoreBackdropClick = true;
          }
        });
      });

      this._showBackdrop(function () {
        return _this10._showElement(relatedTarget);
      });
    };

    Modal.prototype.hide = function hide(event) {
      var _this11 = this;

      if (event) {
        event.preventDefault();
      }

      if (this._isTransitioning || !this._isShown) {
        return;
      }

      var transition = Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE);

      if (transition) {
        this._isTransitioning = true;
      }

      var hideEvent = $.Event(Event.HIDE);

      $(this._element).trigger(hideEvent);

      if (!this._isShown || hideEvent.isDefaultPrevented()) {
        return;
      }

      this._isShown = false;

      this._setEscapeEvent();
      this._setResizeEvent();

      $(document).off(Event.FOCUSIN);

      $(this._element).removeClass(ClassName.SHOW);

      $(this._element).off(Event.CLICK_DISMISS);
      $(this._dialog).off(Event.MOUSEDOWN_DISMISS);

      if (transition) {

        $(this._element).one(Util.TRANSITION_END, function (event) {
          return _this11._hideModal(event);
        }).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        this._hideModal();
      }
    };

    Modal.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);

      $(window, document, this._element, this._backdrop).off(EVENT_KEY);

      this._config = null;
      this._element = null;
      this._dialog = null;
      this._backdrop = null;
      this._isShown = null;
      this._isBodyOverflowing = null;
      this._ignoreBackdropClick = null;
      this._scrollbarWidth = null;
    };

    Modal.prototype.handleUpdate = function handleUpdate() {
      this._adjustDialog();
    };

    // private

    Modal.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, Default, config);
      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    Modal.prototype._showElement = function _showElement(relatedTarget) {
      var _this12 = this;

      var transition = Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE);

      if (!this._element.parentNode || this._element.parentNode.nodeType !== Node.ELEMENT_NODE) {
        // don't move modals dom position
        document.body.appendChild(this._element);
      }

      this._element.style.display = 'block';
      this._element.removeAttribute('aria-hidden');
      this._element.scrollTop = 0;

      if (transition) {
        Util.reflow(this._element);
      }

      $(this._element).addClass(ClassName.SHOW);

      if (this._config.focus) {
        this._enforceFocus();
      }

      var shownEvent = $.Event(Event.SHOWN, {
        relatedTarget: relatedTarget
      });

      var transitionComplete = function transitionComplete() {
        if (_this12._config.focus) {
          _this12._element.focus();
        }
        _this12._isTransitioning = false;
        $(_this12._element).trigger(shownEvent);
      };

      if (transition) {
        $(this._dialog).one(Util.TRANSITION_END, transitionComplete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        transitionComplete();
      }
    };

    Modal.prototype._enforceFocus = function _enforceFocus() {
      var _this13 = this;

      $(document).off(Event.FOCUSIN) // guard against infinite focus loop
      .on(Event.FOCUSIN, function (event) {
        if (document !== event.target && _this13._element !== event.target && !$(_this13._element).has(event.target).length) {
          _this13._element.focus();
        }
      });
    };

    Modal.prototype._setEscapeEvent = function _setEscapeEvent() {
      var _this14 = this;

      if (this._isShown && this._config.keyboard) {
        $(this._element).on(Event.KEYDOWN_DISMISS, function (event) {
          if (event.which === ESCAPE_KEYCODE) {
            event.preventDefault();
            _this14.hide();
          }
        });
      } else if (!this._isShown) {
        $(this._element).off(Event.KEYDOWN_DISMISS);
      }
    };

    Modal.prototype._setResizeEvent = function _setResizeEvent() {
      var _this15 = this;

      if (this._isShown) {
        $(window).on(Event.RESIZE, function (event) {
          return _this15.handleUpdate(event);
        });
      } else {
        $(window).off(Event.RESIZE);
      }
    };

    Modal.prototype._hideModal = function _hideModal() {
      var _this16 = this;

      this._element.style.display = 'none';
      this._element.setAttribute('aria-hidden', true);
      this._isTransitioning = false;
      this._showBackdrop(function () {
        $(document.body).removeClass(ClassName.OPEN);
        _this16._resetAdjustments();
        _this16._resetScrollbar();
        $(_this16._element).trigger(Event.HIDDEN);
      });
    };

    Modal.prototype._removeBackdrop = function _removeBackdrop() {
      if (this._backdrop) {
        $(this._backdrop).remove();
        this._backdrop = null;
      }
    };

    Modal.prototype._showBackdrop = function _showBackdrop(callback) {
      var _this17 = this;

      var animate = $(this._element).hasClass(ClassName.FADE) ? ClassName.FADE : '';

      if (this._isShown && this._config.backdrop) {
        var doAnimate = Util.supportsTransitionEnd() && animate;

        this._backdrop = document.createElement('div');
        this._backdrop.className = ClassName.BACKDROP;

        if (animate) {
          $(this._backdrop).addClass(animate);
        }

        $(this._backdrop).appendTo(document.body);

        $(this._element).on(Event.CLICK_DISMISS, function (event) {
          if (_this17._ignoreBackdropClick) {
            _this17._ignoreBackdropClick = false;
            return;
          }
          if (event.target !== event.currentTarget) {
            return;
          }
          if (_this17._config.backdrop === 'static') {
            _this17._element.focus();
          } else {
            _this17.hide();
          }
        });

        if (doAnimate) {
          Util.reflow(this._backdrop);
        }

        $(this._backdrop).addClass(ClassName.SHOW);

        if (!callback) {
          return;
        }

        if (!doAnimate) {
          callback();
          return;
        }

        $(this._backdrop).one(Util.TRANSITION_END, callback).emulateTransitionEnd(BACKDROP_TRANSITION_DURATION);
      } else if (!this._isShown && this._backdrop) {
        $(this._backdrop).removeClass(ClassName.SHOW);

        var callbackRemove = function callbackRemove() {
          _this17._removeBackdrop();
          if (callback) {
            callback();
          }
        };

        if (Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE)) {
          $(this._backdrop).one(Util.TRANSITION_END, callbackRemove).emulateTransitionEnd(BACKDROP_TRANSITION_DURATION);
        } else {
          callbackRemove();
        }
      } else if (callback) {
        callback();
      }
    };

    // ----------------------------------------------------------------------
    // the following methods are used to handle overflowing modals
    // todo (fat): these should probably be refactored out of modal.js
    // ----------------------------------------------------------------------

    Modal.prototype._adjustDialog = function _adjustDialog() {
      var isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;

      if (!this._isBodyOverflowing && isModalOverflowing) {
        this._element.style.paddingLeft = this._scrollbarWidth + 'px';
      }

      if (this._isBodyOverflowing && !isModalOverflowing) {
        this._element.style.paddingRight = this._scrollbarWidth + 'px';
      }
    };

    Modal.prototype._resetAdjustments = function _resetAdjustments() {
      this._element.style.paddingLeft = '';
      this._element.style.paddingRight = '';
    };

    Modal.prototype._checkScrollbar = function _checkScrollbar() {
      this._isBodyOverflowing = document.body.clientWidth < window.innerWidth;
      this._scrollbarWidth = this._getScrollbarWidth();
    };

    Modal.prototype._setScrollbar = function _setScrollbar() {
      var _this18 = this;

      if (this._isBodyOverflowing) {
        // Note: DOMNode.style.paddingRight returns the actual value or '' if not set
        //   while $(DOMNode).css('padding-right') returns the calculated value or 0 if not set

        // Adjust fixed content padding
        $(Selector.FIXED_CONTENT).each(function (index, element) {
          var actualPadding = $(element)[0].style.paddingRight;
          var calculatedPadding = $(element).css('padding-right');
          $(element).data('padding-right', actualPadding).css('padding-right', parseFloat(calculatedPadding) + _this18._scrollbarWidth + 'px');
        });

        // Adjust navbar-toggler margin
        $(Selector.NAVBAR_TOGGLER).each(function (index, element) {
          var actualMargin = $(element)[0].style.marginRight;
          var calculatedMargin = $(element).css('margin-right');
          $(element).data('margin-right', actualMargin).css('margin-right', parseFloat(calculatedMargin) + _this18._scrollbarWidth + 'px');
        });

        // Adjust body padding
        var actualPadding = document.body.style.paddingRight;
        var calculatedPadding = $('body').css('padding-right');
        $('body').data('padding-right', actualPadding).css('padding-right', parseFloat(calculatedPadding) + this._scrollbarWidth + 'px');
      }
    };

    Modal.prototype._resetScrollbar = function _resetScrollbar() {
      // Restore fixed content padding
      $(Selector.FIXED_CONTENT).each(function (index, element) {
        var padding = $(element).data('padding-right');
        if (typeof padding !== 'undefined') {
          $(element).css('padding-right', padding).removeData('padding-right');
        }
      });

      // Restore navbar-toggler margin
      $(Selector.NAVBAR_TOGGLER).each(function (index, element) {
        var margin = $(element).data('margin-right');
        if (typeof margin !== 'undefined') {
          $(element).css('margin-right', margin).removeData('margin-right');
        }
      });

      // Restore body padding
      var padding = $('body').data('padding-right');
      if (typeof padding !== 'undefined') {
        $('body').css('padding-right', padding).removeData('padding-right');
      }
    };

    Modal.prototype._getScrollbarWidth = function _getScrollbarWidth() {
      // thx d.walsh
      var scrollDiv = document.createElement('div');
      scrollDiv.className = ClassName.SCROLLBAR_MEASURER;
      document.body.appendChild(scrollDiv);
      var scrollbarWidth = scrollDiv.getBoundingClientRect().width - scrollDiv.clientWidth;
      document.body.removeChild(scrollDiv);
      return scrollbarWidth;
    };

    // static

    Modal._jQueryInterface = function _jQueryInterface(config, relatedTarget) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = $.extend({}, Modal.Default, $(this).data(), (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config);

        if (!data) {
          data = new Modal(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config](relatedTarget);
        } else if (_config.show) {
          data.show(relatedTarget);
        }
      });
    };

    _createClass(Modal, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }]);

    return Modal;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    var _this19 = this;

    var target = void 0;
    var selector = Util.getSelectorFromElement(this);

    if (selector) {
      target = $(selector)[0];
    }

    var config = $(target).data(DATA_KEY) ? 'toggle' : $.extend({}, $(target).data(), $(this).data());

    if (this.tagName === 'A' || this.tagName === 'AREA') {
      event.preventDefault();
    }

    var $target = $(target).one(Event.SHOW, function (showEvent) {
      if (showEvent.isDefaultPrevented()) {
        // only register focus restorer if modal will actually get shown
        return;
      }

      $target.one(Event.HIDDEN, function () {
        if ($(_this19).is(':visible')) {
          _this19.focus();
        }
      });
    });

    Modal._jQueryInterface.call($(target), config, this);
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Modal._jQueryInterface;
  $.fn[NAME].Constructor = Modal;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Modal._jQueryInterface;
  };

  return Modal;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): scrollspy.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var ScrollSpy = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'scrollspy';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.scrollspy';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];

  var Default = {
    offset: 10,
    method: 'auto',
    target: ''
  };

  var DefaultType = {
    offset: 'number',
    method: 'string',
    target: '(string|element)'
  };

  var Event = {
    ACTIVATE: 'activate' + EVENT_KEY,
    SCROLL: 'scroll' + EVENT_KEY,
    LOAD_DATA_API: 'load' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    DROPDOWN_ITEM: 'dropdown-item',
    DROPDOWN_MENU: 'dropdown-menu',
    ACTIVE: 'active'
  };

  var Selector = {
    DATA_SPY: '[data-spy="scroll"]',
    ACTIVE: '.active',
    NAV_LIST_GROUP: '.nav, .list-group',
    NAV_LINKS: '.nav-link',
    LIST_ITEMS: '.list-group-item',
    DROPDOWN: '.dropdown',
    DROPDOWN_ITEMS: '.dropdown-item',
    DROPDOWN_TOGGLE: '.dropdown-toggle'
  };

  var OffsetMethod = {
    OFFSET: 'offset',
    POSITION: 'position'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var ScrollSpy = function () {
    function ScrollSpy(element, config) {
      var _this20 = this;

      _classCallCheck(this, ScrollSpy);

      this._element = element;
      this._scrollElement = element.tagName === 'BODY' ? window : element;
      this._config = this._getConfig(config);
      this._selector = this._config.target + ' ' + Selector.NAV_LINKS + ',' + (this._config.target + ' ' + Selector.LIST_ITEMS + ',') + (this._config.target + ' ' + Selector.DROPDOWN_ITEMS);
      this._offsets = [];
      this._targets = [];
      this._activeTarget = null;
      this._scrollHeight = 0;

      $(this._scrollElement).on(Event.SCROLL, function (event) {
        return _this20._process(event);
      });

      this.refresh();
      this._process();
    }

    // getters

    // public

    ScrollSpy.prototype.refresh = function refresh() {
      var _this21 = this;

      var autoMethod = this._scrollElement !== this._scrollElement.window ? OffsetMethod.POSITION : OffsetMethod.OFFSET;

      var offsetMethod = this._config.method === 'auto' ? autoMethod : this._config.method;

      var offsetBase = offsetMethod === OffsetMethod.POSITION ? this._getScrollTop() : 0;

      this._offsets = [];
      this._targets = [];

      this._scrollHeight = this._getScrollHeight();

      var targets = $.makeArray($(this._selector));

      targets.map(function (element) {
        var target = void 0;
        var targetSelector = Util.getSelectorFromElement(element);

        if (targetSelector) {
          target = $(targetSelector)[0];
        }

        if (target) {
          var targetBCR = target.getBoundingClientRect();
          if (targetBCR.width || targetBCR.height) {
            // todo (fat): remove sketch reliance on jQuery position/offset
            return [$(target)[offsetMethod]().top + offsetBase, targetSelector];
          }
        }
        return null;
      }).filter(function (item) {
        return item;
      }).sort(function (a, b) {
        return a[0] - b[0];
      }).forEach(function (item) {
        _this21._offsets.push(item[0]);
        _this21._targets.push(item[1]);
      });
    };

    ScrollSpy.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      $(this._scrollElement).off(EVENT_KEY);

      this._element = null;
      this._scrollElement = null;
      this._config = null;
      this._selector = null;
      this._offsets = null;
      this._targets = null;
      this._activeTarget = null;
      this._scrollHeight = null;
    };

    // private

    ScrollSpy.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, Default, config);

      if (typeof config.target !== 'string') {
        var id = $(config.target).attr('id');
        if (!id) {
          id = Util.getUID(NAME);
          $(config.target).attr('id', id);
        }
        config.target = '#' + id;
      }

      Util.typeCheckConfig(NAME, config, DefaultType);

      return config;
    };

    ScrollSpy.prototype._getScrollTop = function _getScrollTop() {
      return this._scrollElement === window ? this._scrollElement.pageYOffset : this._scrollElement.scrollTop;
    };

    ScrollSpy.prototype._getScrollHeight = function _getScrollHeight() {
      return this._scrollElement.scrollHeight || Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    };

    ScrollSpy.prototype._getOffsetHeight = function _getOffsetHeight() {
      return this._scrollElement === window ? window.innerHeight : this._scrollElement.getBoundingClientRect().height;
    };

    ScrollSpy.prototype._process = function _process() {
      var scrollTop = this._getScrollTop() + this._config.offset;
      var scrollHeight = this._getScrollHeight();
      var maxScroll = this._config.offset + scrollHeight - this._getOffsetHeight();

      if (this._scrollHeight !== scrollHeight) {
        this.refresh();
      }

      if (scrollTop >= maxScroll) {
        var target = this._targets[this._targets.length - 1];

        if (this._activeTarget !== target) {
          this._activate(target);
        }
        return;
      }

      if (this._activeTarget && scrollTop < this._offsets[0] && this._offsets[0] > 0) {
        this._activeTarget = null;
        this._clear();
        return;
      }

      for (var i = this._offsets.length; i--;) {
        var isActiveTarget = this._activeTarget !== this._targets[i] && scrollTop >= this._offsets[i] && (this._offsets[i + 1] === undefined || scrollTop < this._offsets[i + 1]);

        if (isActiveTarget) {
          this._activate(this._targets[i]);
        }
      }
    };

    ScrollSpy.prototype._activate = function _activate(target) {
      this._activeTarget = target;

      this._clear();

      var queries = this._selector.split(',');
      queries = queries.map(function (selector) {
        return selector + '[data-target="' + target + '"],' + (selector + '[href="' + target + '"]');
      });

      var $link = $(queries.join(','));

      if ($link.hasClass(ClassName.DROPDOWN_ITEM)) {
        $link.closest(Selector.DROPDOWN).find(Selector.DROPDOWN_TOGGLE).addClass(ClassName.ACTIVE);
        $link.addClass(ClassName.ACTIVE);
      } else {
        // Set triggered link as active
        $link.addClass(ClassName.ACTIVE);
        // Set triggered links parents as active
        // With both <ul> and <nav> markup a parent is the previous sibling of any nav ancestor
        $link.parents(Selector.NAV_LIST_GROUP).prev(Selector.NAV_LINKS + ', ' + Selector.LIST_ITEMS).addClass(ClassName.ACTIVE);
      }

      $(this._scrollElement).trigger(Event.ACTIVATE, {
        relatedTarget: target
      });
    };

    ScrollSpy.prototype._clear = function _clear() {
      $(this._selector).filter(Selector.ACTIVE).removeClass(ClassName.ACTIVE);
    };

    // static

    ScrollSpy._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config;

        if (!data) {
          data = new ScrollSpy(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(ScrollSpy, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }]);

    return ScrollSpy;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(window).on(Event.LOAD_DATA_API, function () {
    var scrollSpys = $.makeArray($(Selector.DATA_SPY));

    for (var i = scrollSpys.length; i--;) {
      var $spy = $(scrollSpys[i]);
      ScrollSpy._jQueryInterface.call($spy, $spy.data());
    }
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = ScrollSpy._jQueryInterface;
  $.fn[NAME].Constructor = ScrollSpy;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return ScrollSpy._jQueryInterface;
  };

  return ScrollSpy;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): tab.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Tab = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'tab';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.tab';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 150;

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    DROPDOWN_MENU: 'dropdown-menu',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    DROPDOWN: '.dropdown',
    NAV_LIST_GROUP: '.nav, .list-group',
    ACTIVE: '.active',
    DATA_TOGGLE: '[data-toggle="tab"], [data-toggle="pill"], [data-toggle="list"]',
    DROPDOWN_TOGGLE: '.dropdown-toggle',
    DROPDOWN_ACTIVE_CHILD: '> .dropdown-menu .active'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Tab = function () {
    function Tab(element) {
      _classCallCheck(this, Tab);

      this._element = element;
    }

    // getters

    // public

    Tab.prototype.show = function show() {
      var _this22 = this;

      if (this._element.parentNode && this._element.parentNode.nodeType === Node.ELEMENT_NODE && $(this._element).hasClass(ClassName.ACTIVE) || $(this._element).hasClass(ClassName.DISABLED)) {
        return;
      }

      var target = void 0;
      var previous = void 0;
      var listElement = $(this._element).closest(Selector.NAV_LIST_GROUP)[0];
      var selector = Util.getSelectorFromElement(this._element);

      if (listElement) {
        previous = $.makeArray($(listElement).find(Selector.ACTIVE));
        previous = previous[previous.length - 1];
      }

      var hideEvent = $.Event(Event.HIDE, {
        relatedTarget: this._element
      });

      var showEvent = $.Event(Event.SHOW, {
        relatedTarget: previous
      });

      if (previous) {
        $(previous).trigger(hideEvent);
      }

      $(this._element).trigger(showEvent);

      if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) {
        return;
      }

      if (selector) {
        target = $(selector)[0];
      }

      this._activate(this._element, listElement);

      var complete = function complete() {
        var hiddenEvent = $.Event(Event.HIDDEN, {
          relatedTarget: _this22._element
        });

        var shownEvent = $.Event(Event.SHOWN, {
          relatedTarget: previous
        });

        $(previous).trigger(hiddenEvent);
        $(_this22._element).trigger(shownEvent);
      };

      if (target) {
        this._activate(target, target.parentNode, complete);
      } else {
        complete();
      }
    };

    Tab.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      this._element = null;
    };

    // private

    Tab.prototype._activate = function _activate(element, container, callback) {
      var _this23 = this;

      var active = $(container).find(Selector.ACTIVE)[0];
      var isTransitioning = callback && Util.supportsTransitionEnd() && active && $(active).hasClass(ClassName.FADE);

      var complete = function complete() {
        return _this23._transitionComplete(element, active, isTransitioning, callback);
      };

      if (active && isTransitioning) {
        $(active).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        complete();
      }

      if (active) {
        $(active).removeClass(ClassName.SHOW);
      }
    };

    Tab.prototype._transitionComplete = function _transitionComplete(element, active, isTransitioning, callback) {
      if (active) {
        $(active).removeClass(ClassName.ACTIVE);

        var dropdownChild = $(active.parentNode).find(Selector.DROPDOWN_ACTIVE_CHILD)[0];

        if (dropdownChild) {
          $(dropdownChild).removeClass(ClassName.ACTIVE);
        }

        active.setAttribute('aria-expanded', false);
      }

      $(element).addClass(ClassName.ACTIVE);
      element.setAttribute('aria-expanded', true);

      if (isTransitioning) {
        Util.reflow(element);
        $(element).addClass(ClassName.SHOW);
      } else {
        $(element).removeClass(ClassName.FADE);
      }

      if (element.parentNode && $(element.parentNode).hasClass(ClassName.DROPDOWN_MENU)) {

        var dropdownElement = $(element).closest(Selector.DROPDOWN)[0];
        if (dropdownElement) {
          $(dropdownElement).find(Selector.DROPDOWN_TOGGLE).addClass(ClassName.ACTIVE);
        }

        element.setAttribute('aria-expanded', true);
      }

      if (callback) {
        callback();
      }
    };

    // static

    Tab._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var $this = $(this);
        var data = $this.data(DATA_KEY);

        if (!data) {
          data = new Tab(this);
          $this.data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(Tab, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }]);

    return Tab;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    event.preventDefault();
    Tab._jQueryInterface.call($(this), 'show');
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Tab._jQueryInterface;
  $.fn[NAME].Constructor = Tab;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Tab._jQueryInterface;
  };

  return Tab;
}(jQuery);

/* global Popper */

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): tooltip.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Tooltip = function ($) {

  /**
   * Check for Popper dependency
   * Popper - https://popper.js.org
   */
  if (typeof Popper === 'undefined') {
    throw new Error('Bootstrap tooltips require Popper.js (https://popper.js.org)');
  }

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'tooltip';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.tooltip';
  var EVENT_KEY = '.' + DATA_KEY;
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 150;
  var CLASS_PREFIX = 'bs-tooltip';
  var BSCLS_PREFIX_REGEX = new RegExp('(^|\\s)' + CLASS_PREFIX + '\\S+', 'g');

  var DefaultType = {
    animation: 'boolean',
    template: 'string',
    title: '(string|element|function)',
    trigger: 'string',
    delay: '(number|object)',
    html: 'boolean',
    selector: '(string|boolean)',
    placement: '(string|function)',
    offset: '(number|string)',
    container: '(string|element|boolean)',
    fallbackPlacement: '(string|array)'
  };

  var AttachmentMap = {
    AUTO: 'auto',
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left'
  };

  var Default = {
    animation: true,
    template: '<div class="tooltip" role="tooltip">' + '<div class="arrow"></div>' + '<div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    selector: false,
    placement: 'top',
    offset: 0,
    container: false,
    fallbackPlacement: 'flip'
  };

  var HoverState = {
    SHOW: 'show',
    OUT: 'out'
  };

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    INSERTED: 'inserted' + EVENT_KEY,
    CLICK: 'click' + EVENT_KEY,
    FOCUSIN: 'focusin' + EVENT_KEY,
    FOCUSOUT: 'focusout' + EVENT_KEY,
    MOUSEENTER: 'mouseenter' + EVENT_KEY,
    MOUSELEAVE: 'mouseleave' + EVENT_KEY
  };

  var ClassName = {
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    TOOLTIP: '.tooltip',
    TOOLTIP_INNER: '.tooltip-inner',
    ARROW: '.arrow'
  };

  var Trigger = {
    HOVER: 'hover',
    FOCUS: 'focus',
    CLICK: 'click',
    MANUAL: 'manual'

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Tooltip = function () {
    function Tooltip(element, config) {
      _classCallCheck(this, Tooltip);

      // private
      this._isEnabled = true;
      this._timeout = 0;
      this._hoverState = '';
      this._activeTrigger = {};
      this._popper = null;

      // protected
      this.element = element;
      this.config = this._getConfig(config);
      this.tip = null;

      this._setListeners();
    }

    // getters

    // public

    Tooltip.prototype.enable = function enable() {
      this._isEnabled = true;
    };

    Tooltip.prototype.disable = function disable() {
      this._isEnabled = false;
    };

    Tooltip.prototype.toggleEnabled = function toggleEnabled() {
      this._isEnabled = !this._isEnabled;
    };

    Tooltip.prototype.toggle = function toggle(event) {
      if (event) {
        var dataKey = this.constructor.DATA_KEY;
        var context = $(event.currentTarget).data(dataKey);

        if (!context) {
          context = new this.constructor(event.currentTarget, this._getDelegateConfig());
          $(event.currentTarget).data(dataKey, context);
        }

        context._activeTrigger.click = !context._activeTrigger.click;

        if (context._isWithActiveTrigger()) {
          context._enter(null, context);
        } else {
          context._leave(null, context);
        }
      } else {

        if ($(this.getTipElement()).hasClass(ClassName.SHOW)) {
          this._leave(null, this);
          return;
        }

        this._enter(null, this);
      }
    };

    Tooltip.prototype.dispose = function dispose() {
      clearTimeout(this._timeout);

      $.removeData(this.element, this.constructor.DATA_KEY);

      $(this.element).off(this.constructor.EVENT_KEY);
      $(this.element).closest('.modal').off('hide.bs.modal');

      if (this.tip) {
        $(this.tip).remove();
      }

      this._isEnabled = null;
      this._timeout = null;
      this._hoverState = null;
      this._activeTrigger = null;
      if (this._popper !== null) {
        this._popper.destroy();
      }
      this._popper = null;

      this.element = null;
      this.config = null;
      this.tip = null;
    };

    Tooltip.prototype.show = function show() {
      var _this24 = this;

      if ($(this.element).css('display') === 'none') {
        throw new Error('Please use show on visible elements');
      }

      var showEvent = $.Event(this.constructor.Event.SHOW);
      if (this.isWithContent() && this._isEnabled) {
        $(this.element).trigger(showEvent);

        var isInTheDom = $.contains(this.element.ownerDocument.documentElement, this.element);

        if (showEvent.isDefaultPrevented() || !isInTheDom) {
          return;
        }

        var tip = this.getTipElement();
        var tipId = Util.getUID(this.constructor.NAME);

        tip.setAttribute('id', tipId);
        this.element.setAttribute('aria-describedby', tipId);

        this.setContent();

        if (this.config.animation) {
          $(tip).addClass(ClassName.FADE);
        }

        var placement = typeof this.config.placement === 'function' ? this.config.placement.call(this, tip, this.element) : this.config.placement;

        var attachment = this._getAttachment(placement);
        this.addAttachmentClass(attachment);

        var container = this.config.container === false ? document.body : $(this.config.container);

        $(tip).data(this.constructor.DATA_KEY, this);

        if (!$.contains(this.element.ownerDocument.documentElement, this.tip)) {
          $(tip).appendTo(container);
        }

        $(this.element).trigger(this.constructor.Event.INSERTED);

        this._popper = new Popper(this.element, tip, {
          placement: attachment,
          modifiers: {
            offset: {
              offset: this.config.offset
            },
            flip: {
              behavior: this.config.fallbackPlacement
            },
            arrow: {
              element: Selector.ARROW
            }
          },
          onCreate: function onCreate(data) {
            if (data.originalPlacement !== data.placement) {
              _this24._handlePopperPlacementChange(data);
            }
          },
          onUpdate: function onUpdate(data) {
            _this24._handlePopperPlacementChange(data);
          }
        });

        $(tip).addClass(ClassName.SHOW);

        // if this is a touch-enabled device we add extra
        // empty mouseover listeners to the body's immediate children;
        // only needed because of broken event delegation on iOS
        // https://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html
        if ('ontouchstart' in document.documentElement) {
          $('body').children().on('mouseover', null, $.noop);
        }

        var complete = function complete() {
          if (_this24.config.animation) {
            _this24._fixTransition();
          }
          var prevHoverState = _this24._hoverState;
          _this24._hoverState = null;

          $(_this24.element).trigger(_this24.constructor.Event.SHOWN);

          if (prevHoverState === HoverState.OUT) {
            _this24._leave(null, _this24);
          }
        };

        if (Util.supportsTransitionEnd() && $(this.tip).hasClass(ClassName.FADE)) {
          $(this.tip).one(Util.TRANSITION_END, complete).emulateTransitionEnd(Tooltip._TRANSITION_DURATION);
        } else {
          complete();
        }
      }
    };

    Tooltip.prototype.hide = function hide(callback) {
      var _this25 = this;

      var tip = this.getTipElement();
      var hideEvent = $.Event(this.constructor.Event.HIDE);
      var complete = function complete() {
        if (_this25._hoverState !== HoverState.SHOW && tip.parentNode) {
          tip.parentNode.removeChild(tip);
        }

        _this25._cleanTipClass();
        _this25.element.removeAttribute('aria-describedby');
        $(_this25.element).trigger(_this25.constructor.Event.HIDDEN);
        if (_this25._popper !== null) {
          _this25._popper.destroy();
        }

        if (callback) {
          callback();
        }
      };

      $(this.element).trigger(hideEvent);

      if (hideEvent.isDefaultPrevented()) {
        return;
      }

      $(tip).removeClass(ClassName.SHOW);

      // if this is a touch-enabled device we remove the extra
      // empty mouseover listeners we added for iOS support
      if ('ontouchstart' in document.documentElement) {
        $('body').children().off('mouseover', null, $.noop);
      }

      this._activeTrigger[Trigger.CLICK] = false;
      this._activeTrigger[Trigger.FOCUS] = false;
      this._activeTrigger[Trigger.HOVER] = false;

      if (Util.supportsTransitionEnd() && $(this.tip).hasClass(ClassName.FADE)) {

        $(tip).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        complete();
      }

      this._hoverState = '';
    };

    Tooltip.prototype.update = function update() {
      if (this._popper !== null) {
        this._popper.scheduleUpdate();
      }
    };

    // protected

    Tooltip.prototype.isWithContent = function isWithContent() {
      return Boolean(this.getTitle());
    };

    Tooltip.prototype.addAttachmentClass = function addAttachmentClass(attachment) {
      $(this.getTipElement()).addClass(CLASS_PREFIX + '-' + attachment);
    };

    Tooltip.prototype.getTipElement = function getTipElement() {
      return this.tip = this.tip || $(this.config.template)[0];
    };

    Tooltip.prototype.setContent = function setContent() {
      var $tip = $(this.getTipElement());
      this.setElementContent($tip.find(Selector.TOOLTIP_INNER), this.getTitle());
      $tip.removeClass(ClassName.FADE + ' ' + ClassName.SHOW);
    };

    Tooltip.prototype.setElementContent = function setElementContent($element, content) {
      var html = this.config.html;
      if ((typeof content === 'undefined' ? 'undefined' : _typeof(content)) === 'object' && (content.nodeType || content.jquery)) {
        // content is a DOM node or a jQuery
        if (html) {
          if (!$(content).parent().is($element)) {
            $element.empty().append(content);
          }
        } else {
          $element.text($(content).text());
        }
      } else {
        $element[html ? 'html' : 'text'](content);
      }
    };

    Tooltip.prototype.getTitle = function getTitle() {
      var title = this.element.getAttribute('data-original-title');

      if (!title) {
        title = typeof this.config.title === 'function' ? this.config.title.call(this.element) : this.config.title;
      }

      return title;
    };

    // private

    Tooltip.prototype._getAttachment = function _getAttachment(placement) {
      return AttachmentMap[placement.toUpperCase()];
    };

    Tooltip.prototype._setListeners = function _setListeners() {
      var _this26 = this;

      var triggers = this.config.trigger.split(' ');

      triggers.forEach(function (trigger) {
        if (trigger === 'click') {
          $(_this26.element).on(_this26.constructor.Event.CLICK, _this26.config.selector, function (event) {
            return _this26.toggle(event);
          });
        } else if (trigger !== Trigger.MANUAL) {
          var eventIn = trigger === Trigger.HOVER ? _this26.constructor.Event.MOUSEENTER : _this26.constructor.Event.FOCUSIN;
          var eventOut = trigger === Trigger.HOVER ? _this26.constructor.Event.MOUSELEAVE : _this26.constructor.Event.FOCUSOUT;

          $(_this26.element).on(eventIn, _this26.config.selector, function (event) {
            return _this26._enter(event);
          }).on(eventOut, _this26.config.selector, function (event) {
            return _this26._leave(event);
          });
        }

        $(_this26.element).closest('.modal').on('hide.bs.modal', function () {
          return _this26.hide();
        });
      });

      if (this.config.selector) {
        this.config = $.extend({}, this.config, {
          trigger: 'manual',
          selector: ''
        });
      } else {
        this._fixTitle();
      }
    };

    Tooltip.prototype._fixTitle = function _fixTitle() {
      var titleType = _typeof(this.element.getAttribute('data-original-title'));
      if (this.element.getAttribute('title') || titleType !== 'string') {
        this.element.setAttribute('data-original-title', this.element.getAttribute('title') || '');
        this.element.setAttribute('title', '');
      }
    };

    Tooltip.prototype._enter = function _enter(event, context) {
      var dataKey = this.constructor.DATA_KEY;

      context = context || $(event.currentTarget).data(dataKey);

      if (!context) {
        context = new this.constructor(event.currentTarget, this._getDelegateConfig());
        $(event.currentTarget).data(dataKey, context);
      }

      if (event) {
        context._activeTrigger[event.type === 'focusin' ? Trigger.FOCUS : Trigger.HOVER] = true;
      }

      if ($(context.getTipElement()).hasClass(ClassName.SHOW) || context._hoverState === HoverState.SHOW) {
        context._hoverState = HoverState.SHOW;
        return;
      }

      clearTimeout(context._timeout);

      context._hoverState = HoverState.SHOW;

      if (!context.config.delay || !context.config.delay.show) {
        context.show();
        return;
      }

      context._timeout = setTimeout(function () {
        if (context._hoverState === HoverState.SHOW) {
          context.show();
        }
      }, context.config.delay.show);
    };

    Tooltip.prototype._leave = function _leave(event, context) {
      var dataKey = this.constructor.DATA_KEY;

      context = context || $(event.currentTarget).data(dataKey);

      if (!context) {
        context = new this.constructor(event.currentTarget, this._getDelegateConfig());
        $(event.currentTarget).data(dataKey, context);
      }

      if (event) {
        context._activeTrigger[event.type === 'focusout' ? Trigger.FOCUS : Trigger.HOVER] = false;
      }

      if (context._isWithActiveTrigger()) {
        return;
      }

      clearTimeout(context._timeout);

      context._hoverState = HoverState.OUT;

      if (!context.config.delay || !context.config.delay.hide) {
        context.hide();
        return;
      }

      context._timeout = setTimeout(function () {
        if (context._hoverState === HoverState.OUT) {
          context.hide();
        }
      }, context.config.delay.hide);
    };

    Tooltip.prototype._isWithActiveTrigger = function _isWithActiveTrigger() {
      for (var trigger in this._activeTrigger) {
        if (this._activeTrigger[trigger]) {
          return true;
        }
      }

      return false;
    };

    Tooltip.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, this.constructor.Default, $(this.element).data(), config);

      if (config.delay && typeof config.delay === 'number') {
        config.delay = {
          show: config.delay,
          hide: config.delay
        };
      }

      if (config.title && typeof config.title === 'number') {
        config.title = config.title.toString();
      }

      if (config.content && typeof config.content === 'number') {
        config.content = config.content.toString();
      }

      Util.typeCheckConfig(NAME, config, this.constructor.DefaultType);

      return config;
    };

    Tooltip.prototype._getDelegateConfig = function _getDelegateConfig() {
      var config = {};

      if (this.config) {
        for (var key in this.config) {
          if (this.constructor.Default[key] !== this.config[key]) {
            config[key] = this.config[key];
          }
        }
      }

      return config;
    };

    Tooltip.prototype._cleanTipClass = function _cleanTipClass() {
      var $tip = $(this.getTipElement());
      var tabClass = $tip.attr('class').match(BSCLS_PREFIX_REGEX);
      if (tabClass !== null && tabClass.length > 0) {
        $tip.removeClass(tabClass.join(''));
      }
    };

    Tooltip.prototype._handlePopperPlacementChange = function _handlePopperPlacementChange(data) {
      this._cleanTipClass();
      this.addAttachmentClass(this._getAttachment(data.placement));
    };

    Tooltip.prototype._fixTransition = function _fixTransition() {
      var tip = this.getTipElement();
      var initConfigAnimation = this.config.animation;
      if (tip.getAttribute('x-placement') !== null) {
        return;
      }
      $(tip).removeClass(ClassName.FADE);
      this.config.animation = false;
      this.hide();
      this.show();
      this.config.animation = initConfigAnimation;
    };

    // static

    Tooltip._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config;

        if (!data && /dispose|hide/.test(config)) {
          return;
        }

        if (!data) {
          data = new Tooltip(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(Tooltip, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }, {
      key: 'NAME',
      get: function get() {
        return NAME;
      }
    }, {
      key: 'DATA_KEY',
      get: function get() {
        return DATA_KEY;
      }
    }, {
      key: 'Event',
      get: function get() {
        return Event;
      }
    }, {
      key: 'EVENT_KEY',
      get: function get() {
        return EVENT_KEY;
      }
    }, {
      key: 'DefaultType',
      get: function get() {
        return DefaultType;
      }
    }]);

    return Tooltip;
  }();

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Tooltip._jQueryInterface;
  $.fn[NAME].Constructor = Tooltip;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Tooltip._jQueryInterface;
  };

  return Tooltip;
}(jQuery);

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-beta): popover.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Popover = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'popover';
  var VERSION = '4.0.0-beta';
  var DATA_KEY = 'bs.popover';
  var EVENT_KEY = '.' + DATA_KEY;
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var CLASS_PREFIX = 'bs-popover';
  var BSCLS_PREFIX_REGEX = new RegExp('(^|\\s)' + CLASS_PREFIX + '\\S+', 'g');

  var Default = $.extend({}, Tooltip.Default, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover" role="tooltip">' + '<div class="arrow"></div>' + '<h3 class="popover-header"></h3>' + '<div class="popover-body"></div></div>'
  });

  var DefaultType = $.extend({}, Tooltip.DefaultType, {
    content: '(string|element|function)'
  });

  var ClassName = {
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    TITLE: '.popover-header',
    CONTENT: '.popover-body'
  };

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    INSERTED: 'inserted' + EVENT_KEY,
    CLICK: 'click' + EVENT_KEY,
    FOCUSIN: 'focusin' + EVENT_KEY,
    FOCUSOUT: 'focusout' + EVENT_KEY,
    MOUSEENTER: 'mouseenter' + EVENT_KEY,
    MOUSELEAVE: 'mouseleave' + EVENT_KEY

    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };
  var Popover = function (_Tooltip) {
    _inherits(Popover, _Tooltip);

    function Popover() {
      _classCallCheck(this, Popover);

      return _possibleConstructorReturn(this, _Tooltip.apply(this, arguments));
    }

    // overrides

    Popover.prototype.isWithContent = function isWithContent() {
      return this.getTitle() || this._getContent();
    };

    Popover.prototype.addAttachmentClass = function addAttachmentClass(attachment) {
      $(this.getTipElement()).addClass(CLASS_PREFIX + '-' + attachment);
    };

    Popover.prototype.getTipElement = function getTipElement() {
      return this.tip = this.tip || $(this.config.template)[0];
    };

    Popover.prototype.setContent = function setContent() {
      var $tip = $(this.getTipElement());

      // we use append for html objects to maintain js events
      this.setElementContent($tip.find(Selector.TITLE), this.getTitle());
      this.setElementContent($tip.find(Selector.CONTENT), this._getContent());

      $tip.removeClass(ClassName.FADE + ' ' + ClassName.SHOW);
    };

    // private

    Popover.prototype._getContent = function _getContent() {
      return this.element.getAttribute('data-content') || (typeof this.config.content === 'function' ? this.config.content.call(this.element) : this.config.content);
    };

    Popover.prototype._cleanTipClass = function _cleanTipClass() {
      var $tip = $(this.getTipElement());
      var tabClass = $tip.attr('class').match(BSCLS_PREFIX_REGEX);
      if (tabClass !== null && tabClass.length > 0) {
        $tip.removeClass(tabClass.join(''));
      }
    };

    // static

    Popover._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' ? config : null;

        if (!data && /destroy|hide/.test(config)) {
          return;
        }

        if (!data) {
          data = new Popover(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(Popover, null, [{
      key: 'VERSION',


      // getters

      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }, {
      key: 'NAME',
      get: function get() {
        return NAME;
      }
    }, {
      key: 'DATA_KEY',
      get: function get() {
        return DATA_KEY;
      }
    }, {
      key: 'Event',
      get: function get() {
        return Event;
      }
    }, {
      key: 'EVENT_KEY',
      get: function get() {
        return EVENT_KEY;
      }
    }, {
      key: 'DefaultType',
      get: function get() {
        return DefaultType;
      }
    }]);

    return Popover;
  }(Tooltip);

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Popover._jQueryInterface;
  $.fn[NAME].Constructor = Popover;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Popover._jQueryInterface;
  };

  return Popover;
}(jQuery);


})();

/* ============================================================
 * wow.js
 * ============================================================
 */
(function() {
  var MutationObserver, Util, WeakMap, getComputedStyle, getComputedStyleRX,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Util = (function() {
    function Util() {}

    Util.prototype.extend = function(custom, defaults) {
      var key, value;
      for (key in defaults) {
        value = defaults[key];
        if (custom[key] == null) {
          custom[key] = value;
        }
      }
      return custom;
    };

    Util.prototype.isMobile = function(agent) {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(agent);
    };

    Util.prototype.addEvent = function(elem, event, fn) {
      if (elem.addEventListener != null) {
        return elem.addEventListener(event, fn, false);
      } else if (elem.attachEvent != null) {
        return elem.attachEvent("on" + event, fn);
      } else {
        return elem[event] = fn;
      }
    };

    Util.prototype.removeEvent = function(elem, event, fn) {
      if (elem.removeEventListener != null) {
        return elem.removeEventListener(event, fn, false);
      } else if (elem.detachEvent != null) {
        return elem.detachEvent("on" + event, fn);
      } else {
        return delete elem[event];
      }
    };

    Util.prototype.innerHeight = function() {
      if ('innerHeight' in window) {
        return window.innerHeight;
      } else {
        return document.documentElement.clientHeight;
      }
    };

    return Util;

  })();

  WeakMap = this.WeakMap || this.MozWeakMap || (WeakMap = (function() {
    function WeakMap() {
      this.keys = [];
      this.values = [];
    }

    WeakMap.prototype.get = function(key) {
      var i, item, _i, _len, _ref;
      _ref = this.keys;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        item = _ref[i];
        if (item === key) {
          return this.values[i];
        }
      }
    };

    WeakMap.prototype.set = function(key, value) {
      var i, item, _i, _len, _ref;
      _ref = this.keys;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        item = _ref[i];
        if (item === key) {
          this.values[i] = value;
          return;
        }
      }
      this.keys.push(key);
      return this.values.push(value);
    };

    return WeakMap;

  })());

  MutationObserver = this.MutationObserver || this.WebkitMutationObserver || this.MozMutationObserver || (MutationObserver = (function() {
    function MutationObserver() {
      if (typeof console !== "undefined" && console !== null) {
        console.warn('MutationObserver is not supported by your browser.');
      }
      if (typeof console !== "undefined" && console !== null) {
        console.warn('WOW.js cannot detect dom mutations, please call .sync() after loading new content.');
      }
    }

    MutationObserver.notSupported = true;

    MutationObserver.prototype.observe = function() {};

    return MutationObserver;

  })());

  getComputedStyle = this.getComputedStyle || function(el, pseudo) {
    this.getPropertyValue = function(prop) {
      var _ref;
      if (prop === 'float') {
        prop = 'styleFloat';
      }
      if (getComputedStyleRX.test(prop)) {
        prop.replace(getComputedStyleRX, function(_, _char) {
          return _char.toUpperCase();
        });
      }
      return ((_ref = el.currentStyle) != null ? _ref[prop] : void 0) || null;
    };
    return this;
  };

  getComputedStyleRX = /(\-([a-z]){1})/g;

  this.WOW = (function() {
    WOW.prototype.defaults = {
      boxClass: 'wow',
      animateClass: 'animated',
      offset: 0,
      mobile: true,
      live: true,
      callback: null
    };

    function WOW(options) {
      if (options == null) {
        options = {};
      }
      this.scrollCallback = __bind(this.scrollCallback, this);
      this.scrollHandler = __bind(this.scrollHandler, this);
      this.start = __bind(this.start, this);
      this.scrolled = true;
      this.config = this.util().extend(options, this.defaults);
      this.animationNameCache = new WeakMap();
    }

    WOW.prototype.init = function() {
      var _ref;
      this.element = window.document.documentElement;
      if ((_ref = document.readyState) === "interactive" || _ref === "complete") {
        this.start();
      } else {
        this.util().addEvent(document, 'DOMContentLoaded', this.start);
      }
      return this.finished = [];
    };

    WOW.prototype.start = function() {
      var box, _i, _len, _ref;
      this.stopped = false;
      this.boxes = (function() {
        var _i, _len, _ref, _results;
        _ref = this.element.querySelectorAll("." + this.config.boxClass);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          box = _ref[_i];
          _results.push(box);
        }
        return _results;
      }).call(this);
      this.all = (function() {
        var _i, _len, _ref, _results;
        _ref = this.boxes;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          box = _ref[_i];
          _results.push(box);
        }
        return _results;
      }).call(this);
      if (this.boxes.length) {
        if (this.disabled()) {
          this.resetStyle();
        } else {
          _ref = this.boxes;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            box = _ref[_i];
            this.applyStyle(box, true);
          }
        }
      }
      if (!this.disabled()) {
        this.util().addEvent(window, 'scroll', this.scrollHandler);
        this.util().addEvent(window, 'resize', this.scrollHandler);
        this.interval = setInterval(this.scrollCallback, 50);
      }
      if (this.config.live) {
        return new MutationObserver((function(_this) {
          return function(records) {
            var node, record, _j, _len1, _results;
            _results = [];
            for (_j = 0, _len1 = records.length; _j < _len1; _j++) {
              record = records[_j];
              _results.push((function() {
                var _k, _len2, _ref1, _results1;
                _ref1 = record.addedNodes || [];
                _results1 = [];
                for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
                  node = _ref1[_k];
                  _results1.push(this.doSync(node));
                }
                return _results1;
              }).call(_this));
            }
            return _results;
          };
        })(this)).observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    };

    WOW.prototype.stop = function() {
      this.stopped = true;
      this.util().removeEvent(window, 'scroll', this.scrollHandler);
      this.util().removeEvent(window, 'resize', this.scrollHandler);
      if (this.interval != null) {
        return clearInterval(this.interval);
      }
    };

    WOW.prototype.sync = function(element) {
      if (MutationObserver.notSupported) {
        return this.doSync(this.element);
      }
    };

    WOW.prototype.doSync = function(element) {
      var box, _i, _len, _ref, _results;
      if (element == null) {
        element = this.element;
      }
      if (element.nodeType !== 1) {
        return;
      }
      element = element.parentNode || element;
      _ref = element.querySelectorAll("." + this.config.boxClass);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        box = _ref[_i];
        if (__indexOf.call(this.all, box) < 0) {
          this.boxes.push(box);
          this.all.push(box);
          if (this.stopped || this.disabled()) {
            this.resetStyle();
          } else {
            this.applyStyle(box, true);
          }
          _results.push(this.scrolled = true);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    WOW.prototype.show = function(box) {
      this.applyStyle(box);
      box.className = "" + box.className + " " + this.config.animateClass;
      if (this.config.callback != null) {
        return this.config.callback(box);
      }
    };

    WOW.prototype.applyStyle = function(box, hidden) {
      var delay, duration, iteration;
      duration = box.getAttribute('data-wow-duration');
      delay = box.getAttribute('data-wow-delay');
      iteration = box.getAttribute('data-wow-iteration');
      return this.animate((function(_this) {
        return function() {
          return _this.customStyle(box, hidden, duration, delay, iteration);
        };
      })(this));
    };

    WOW.prototype.animate = (function() {
      if ('requestAnimationFrame' in window) {
        return function(callback) {
          return window.requestAnimationFrame(callback);
        };
      } else {
        return function(callback) {
          return callback();
        };
      }
    })();

    WOW.prototype.resetStyle = function() {
      var box, _i, _len, _ref, _results;
      _ref = this.boxes;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        box = _ref[_i];
        _results.push(box.style.visibility = 'visible');
      }
      return _results;
    };

    WOW.prototype.customStyle = function(box, hidden, duration, delay, iteration) {
      if (hidden) {
        this.cacheAnimationName(box);
      }
      box.style.visibility = hidden ? 'hidden' : 'visible';
      if (duration) {
        this.vendorSet(box.style, {
          animationDuration: duration
        });
      }
      if (delay) {
        this.vendorSet(box.style, {
          animationDelay: delay
        });
      }
      if (iteration) {
        this.vendorSet(box.style, {
          animationIterationCount: iteration
        });
      }
      this.vendorSet(box.style, {
        animationName: hidden ? 'none' : this.cachedAnimationName(box)
      });
      return box;
    };

    WOW.prototype.vendors = ["moz", "webkit"];

    WOW.prototype.vendorSet = function(elem, properties) {
      var name, value, vendor, _results;
      _results = [];
      for (name in properties) {
        value = properties[name];
        elem["" + name] = value;
        _results.push((function() {
          var _i, _len, _ref, _results1;
          _ref = this.vendors;
          _results1 = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            vendor = _ref[_i];
            _results1.push(elem["" + vendor + (name.charAt(0).toUpperCase()) + (name.substr(1))] = value);
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    WOW.prototype.vendorCSS = function(elem, property) {
      var result, style, vendor, _i, _len, _ref;
      style = getComputedStyle(elem);
      result = style.getPropertyCSSValue(property);
      _ref = this.vendors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        vendor = _ref[_i];
        result = result || style.getPropertyCSSValue("-" + vendor + "-" + property);
      }
      return result;
    };

    WOW.prototype.animationName = function(box) {
      var animationName;
      try {
        animationName = this.vendorCSS(box, 'animation-name').cssText;
      } catch (_error) {
        animationName = getComputedStyle(box).getPropertyValue('animation-name');
      }
      if (animationName === 'none') {
        return '';
      } else {
        return animationName;
      }
    };

    WOW.prototype.cacheAnimationName = function(box) {
      return this.animationNameCache.set(box, this.animationName(box));
    };

    WOW.prototype.cachedAnimationName = function(box) {
      return this.animationNameCache.get(box);
    };

    WOW.prototype.scrollHandler = function() {
      return this.scrolled = true;
    };

    WOW.prototype.scrollCallback = function() {
      var box;
      if (this.scrolled) {
        this.scrolled = false;
        this.boxes = (function() {
          var _i, _len, _ref, _results;
          _ref = this.boxes;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            box = _ref[_i];
            if (!(box)) {
              continue;
            }
            if (this.isVisible(box)) {
              this.show(box);
              continue;
            }
            _results.push(box);
          }
          return _results;
        }).call(this);
        if (!(this.boxes.length || this.config.live)) {
          return this.stop();
        }
      }
    };

    WOW.prototype.offsetTop = function(element) {
      var top;
      while (element.offsetTop === void 0) {
        element = element.parentNode;
      }
      top = element.offsetTop;
      while (element = element.offsetParent) {
        top += element.offsetTop;
      }
      return top;
    };

    WOW.prototype.isVisible = function(box) {
      var bottom, offset, top, viewBottom, viewTop;
      offset = box.getAttribute('data-wow-offset') || this.config.offset;
      viewTop = window.pageYOffset;
      viewBottom = viewTop + Math.min(this.element.clientHeight, this.util().innerHeight()) - offset;
      top = this.offsetTop(box);
      bottom = top + box.clientHeight;
      return top <= viewBottom && bottom >= viewTop;
    };

    WOW.prototype.util = function() {
      return this._util != null ? this._util : this._util = new Util();
    };

    WOW.prototype.disabled = function() {
      return !this.config.mobile && this.util().isMobile(navigator.userAgent);
    };

    return WOW;

  })();

}).call(this);


/* ============================================================
 * retina-replace.js v1.0
 * http://github.com/leonsmith/retina-replace-js
 * ============================================================
 * Author: Leon Smith
 * Twitter: @nullUK
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */
 (function($) {
    "use strict";
    
    var retinaReplace = function(element, options) {

        this.options = options;
        var $el = $(element);
        var is_image = $el.is('img');
        var normal_url = is_image ? $el.attr('src') : $el.backgroundImageUrl();
        var retina_url = this.options.generateUrl($el, normal_url);

        $('<img/>').attr('src', retina_url).load(function() {

            if (is_image) {
                $el.attr('src', $(this).attr('src'));
            } else {
                $el.backgroundImageUrl($(this).attr('src'));
                $el.backgroundSize($(this)[0].width, $(this)[0].height);
            }

            $el.attr('data-retina', 'complete');
        });
    }

    retinaReplace.prototype = {
        constructor: retinaReplace
    }

    $.fn.retinaReplace = function(option) {
        // Finish if we arn't a retina device
        if (getDevicePixelRatio() <= 1) { return this; }

        return this.each(function() {
            var $this = $(this);
            var data = $this.data('retinaReplace');
            var options = $.extend({}, $.fn.retinaReplace.defaults, $this.data(), typeof option == 'object' && option);
            if (!data) { $this.data('retinaReplace', (data = new retinaReplace(this, options))); }
            if (typeof option == 'string') { data[option](); }
        });
    }
    
    $.fn.retinaReplace.defaults = {
        suffix: '_2x', 
        generateUrl: function(element, url) {
            var dot_index = url.lastIndexOf('.');
            var extension = url.substr(dot_index + 1);
            var file = url.substr(0, dot_index);
            return file + this.suffix + '.' + extension;
        }
    }

    $.fn.retinaReplace.Constructor = retinaReplace;

    // Helper Functions
    var getDevicePixelRatio = function() {
        if (window.devicePixelRatio === undefined) { return 1; }
        return window.devicePixelRatio;
    }

    $.fn.backgroundImageUrl = function(url) {
        return url ? this.each(function () { 
            $(this).css("background-image", 'url("' + url + '")')
        }) : $(this).css("background-image").replace(/url\(|\)|"|'/g, "");
    }

    $.fn.backgroundSize = function(retinaWidth, retinaHeight) {
        var sizeValue = Math.floor(retinaWidth/2) + 'px ' + Math.floor(retinaHeight/2) + 'px';
        $(this).css("background-size", sizeValue);
        $(this).css("-webkit-background-size", sizeValue);
    }

    // Trigger replacement on elements that hav been marked up
    $(function(){
        $("[data-retina='true']").retinaReplace();
    });

})(window.jQuery);

/**
 * Owl Carousel v2.2.1
 * Copyright 2013-2017 David Deutsch
 * Licensed under  ()
 */
/**
 * Owl carousel
 * @version 2.1.6
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from beeing retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat--) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			if (this.settings.center) {
				this.$stage.children('.center').removeClass('center');
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + ' class="' + this.settings.stageClass + '"/>')
			.wrap('<div class="' + this.settings.stageOuterClass + '"/>');

		// append stage
		this.$element.append(this.$stage.parent());

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.$element.is(':visible')) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.$element.is(':visible')) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] || value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's'
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			reciprocalItemsWidth = this._items[--iterator].width();
			elementWidth = this.$element.width();
			while (iterator--) {
				reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
				if (reciprocalItemsWidth > elementWidth) {
					break;
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.$element.is(':visible')) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();

		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.$element.is(':visible');
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.$element.is(':visible') === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
				url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name == 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'style="width:' + video.width + 'px;height:' + video.height + 'px;"' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = '<div class="owl-video-tn ' + lazyClass + '" ' + srcType + '="' + path + '"></div>';
				} else {
					tnLink = '<div class="owl-video-tn" style="opacity:1;background-image:url(' + path + ')"></div>';
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap('<div class="owl-video-wrapper"' + dimensions + '></div>');

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		if (video.type === 'youtube') {
			html = '<iframe width="' + width + '" height="' + height + '" src="//www.youtube.com/embed/' +
				video.id + '?autoplay=1&rel=0&v=' + video.id + '" frameborder="0" allowfullscreen></iframe>';
		} else if (video.type === 'vimeo') {
			html = '<iframe src="//player.vimeo.com/video/' + video.id +
				'?autoplay=1" width="' + width + '" height="' + height +
				'" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
		} else if (video.type === 'vzaar') {
			html = '<iframe frameborder="0"' + 'height="' + height + '"' + 'width="' + width +
				'" allowfullscreen mozallowfullscreen webkitAllowFullScreen ' +
				'src="//view.vzaar.com/' + video.id + '/player?autoplay=true"></iframe>';
		}

		$('<div class="owl-video-frame">' + html + '</div>').insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout.
		 * @type {Timeout}
		 */
		this._timeout = null;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = false;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position') {
					//console.log('play?', e);
					if (this._core.settings.autoplay) {
						this._setAutoPlayInterval();
					}
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		this._paused = false;

		if (this._core.is('rotating')) {
			return;
		}

		this._core.enter('rotating');

		this._setAutoPlayInterval();
	};

	/**
	 * Gets a new timeout
	 * @private
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 * @return {Timeout}
	 */
	Autoplay.prototype._getNextTimeout = function(timeout, speed) {
		if ( this._timeout ) {
			window.clearTimeout(this._timeout);
		}
		return window.setTimeout($.proxy(function() {
			if (this._paused || this._core.is('busy') || this._core.is('interacting') || document.hidden) {
				return;
			}
			this._core.next(speed || this._core.settings.autoplaySpeed);
		}, this), timeout || this._core.settings.autoplayTimeout);
	};

	/**
	 * Sets autoplay in motion.
	 * @private
	 */
	Autoplay.prototype._setAutoPlayInterval = function() {
		this._timeout = this._getNextTimeout();
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		window.clearTimeout(this._timeout);
		this._core.leave('rotating');
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		this._paused = true;
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [ 'prev', 'next' ],
		navSpeed: false,
		navElement: 'div',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [ 'owl-prev', 'owl-next' ],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<div>')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'div', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			this._controls[control].remove();
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.1.0
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);



/**
 * Copyright Marc J. Schmidt. See the LICENSE file at the top-level
 * directory of this distribution and at
 * https://github.com/marcj/css-element-queries/blob/master/LICENSE.
 */
;
(function() {

    /**
     * Class for dimension change detection.
     *
     * @param {Element|Element[]|Elements|jQuery} element
     * @param {Function} callback
     *
     * @constructor
     */
    var ResizeSensor = function(element, callback) {
        /**
         *
         * @constructor
         */
        function EventQueue() {
            this.q = [];
            this.add = function(ev) {
                this.q.push(ev);
            };

            var i, j;
            this.call = function() {
                for (i = 0, j = this.q.length; i < j; i++) {
                    this.q[i].call();
                }
            };
        }

        /**
         * @param {HTMLElement} element
         * @param {String}      prop
         * @returns {String|Number}
         */
        function getComputedStyle(element, prop) {
            if (element.currentStyle) {
                return element.currentStyle[prop];
            } else if (window.getComputedStyle) {
                return window.getComputedStyle(element, null).getPropertyValue(prop);
            } else {
                return element.style[prop];
            }
        }

        /**
         *
         * @param {HTMLElement} element
         * @param {Function}    resized
         */
        function attachResizeEvent(element, resized) {
            if (!element.resizedAttached) {
                element.resizedAttached = new EventQueue();
                element.resizedAttached.add(resized);
            } else if (element.resizedAttached) {
                element.resizedAttached.add(resized);
                return;
            }

            element.resizeSensor = document.createElement('div');
            element.resizeSensor.className = 'resize-sensor';
            var style = 'position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; z-index: -1; visibility: hidden;';
            var styleChild = 'position: absolute; left: 0; top: 0; transition: 0s;';

            element.resizeSensor.style.cssText = style;
            element.resizeSensor.innerHTML =
                '<div class="resize-sensor-expand" style="' + style + '">' +
                    '<div style="' + styleChild + '"></div>' +
                '</div>' +
                '<div class="resize-sensor-shrink" style="' + style + '">' +
                    '<div style="' + styleChild + ' width: 200%; height: 200%"></div>' +
                '</div>';
            element.appendChild(element.resizeSensor);

            if (!{fixed: 1, absolute: 1}[getComputedStyle(element, 'position')]) {
                element.style.position = 'relative';
            }

            var expand = element.resizeSensor.childNodes[0];
            var expandChild = expand.childNodes[0];
            var shrink = element.resizeSensor.childNodes[1];
            var shrinkChild = shrink.childNodes[0];

            var lastWidth, lastHeight;

            var reset = function() {
                expandChild.style.width = expand.offsetWidth + 10 + 'px';
                expandChild.style.height = expand.offsetHeight + 10 + 'px';
                expand.scrollLeft = expand.scrollWidth;
                expand.scrollTop = expand.scrollHeight;
                shrink.scrollLeft = shrink.scrollWidth;
                shrink.scrollTop = shrink.scrollHeight;
                lastWidth = element.offsetWidth;
                lastHeight = element.offsetHeight;
            };

            reset();

            var changed = function() {
                if (element.resizedAttached) {
                    element.resizedAttached.call();
                }
            };

            var addEvent = function(el, name, cb) {
                if (el.attachEvent) {
                    el.attachEvent('on' + name, cb);
                } else {
                    el.addEventListener(name, cb);
                }
            };

            var onScroll = function() {
              if (element.offsetWidth != lastWidth || element.offsetHeight != lastHeight) {
                  changed();
              }
              reset();
            };

            addEvent(expand, 'scroll', onScroll);
            addEvent(shrink, 'scroll', onScroll);
        }

        var elementType = Object.prototype.toString.call(element);
        var isCollectionTyped = ('[object Array]' === elementType
            || ('[object NodeList]' === elementType)
            || ('[object HTMLCollection]' === elementType)
            || ('undefined' !== typeof jQuery && element instanceof jQuery) //jquery
            || ('undefined' !== typeof Elements && element instanceof Elements) //mootools
        );

        if (isCollectionTyped) {
            var i = 0, j = element.length;
            for (; i < j; i++) {
                attachResizeEvent(element[i], callback);
            }
        } else {
            attachResizeEvent(element, callback);
        }

        this.detach = function() {
            if (isCollectionTyped) {
                var i = 0, j = element.length;
                for (; i < j; i++) {
                    ResizeSensor.detach(element[i]);
                }
            } else {
                ResizeSensor.detach(element);
            }
        };
    };

    ResizeSensor.detach = function(element) {
        if (element.resizeSensor) {
            element.removeChild(element.resizeSensor);
            delete element.resizeSensor;
            delete element.resizedAttached;
        }
    };

    // make available to common module loader
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = ResizeSensor;
    }
    else {
        window.ResizeSensor = ResizeSensor;
    }

})();

//# sourceMappingURL=maps/ResizeSensor.js.map
/*!
 * Theia Sticky Sidebar v1.7.0
 * https://github.com/WeCodePixels/theia-sticky-sidebar
 *
 * Glues your website's sidebars, making them permanently visible while scrolling.
 *
 * Copyright 2013-2016 WeCodePixels and other contributors
 * Released under the MIT license
 */

(function ($) {
    $.fn.theiaStickySidebar = function (options) {
        var defaults = {
            'containerSelector': '',
            'additionalMarginTop': 0,
            'additionalMarginBottom': 0,
            'updateSidebarHeight': true,
            'minWidth': 0,
            'disableOnResponsiveLayouts': true,
            'sidebarBehavior': 'modern',
            'defaultPosition': 'relative',
            'namespace': 'TSS'
        };
        options = $.extend(defaults, options);

        // Validate options
        options.additionalMarginTop = parseInt(options.additionalMarginTop) || 0;
        options.additionalMarginBottom = parseInt(options.additionalMarginBottom) || 0;

        tryInitOrHookIntoEvents(options, this);

        // Try doing init, otherwise hook into window.resize and document.scroll and try again then.
        function tryInitOrHookIntoEvents(options, $that) {
            var success = tryInit(options, $that);

            if (!success) {
                console.log('TSS: Body width smaller than options.minWidth. Init is delayed.');

                $(document).on('scroll.' + options.namespace, function (options, $that) {
                    return function (evt) {
                        var success = tryInit(options, $that);

                        if (success) {
                            $(this).unbind(evt);
                        }
                    };
                }(options, $that));
                $(window).on('resize.' + options.namespace, function (options, $that) {
                    return function (evt) {
                        var success = tryInit(options, $that);

                        if (success) {
                            $(this).unbind(evt);
                        }
                    };
                }(options, $that))
            }
        }

        // Try doing init if proper conditions are met.
        function tryInit(options, $that) {
            if (options.initialized === true) {
                return true;
            }

            if ($('body').width() < options.minWidth) {
                return false;
            }

            init(options, $that);

            return true;
        }

        // Init the sticky sidebar(s).
        function init(options, $that) {
            options.initialized = true;

            // Add CSS
            var existingStylesheet = $('#theia-sticky-sidebar-stylesheet-' + options.namespace);
            if (existingStylesheet.length === 0) {
                $('head').append($('<style id="theia-sticky-sidebar-stylesheet-' + options.namespace + '">.theiaStickySidebar:after {content: ""; display: table; clear: both;}</style>'));
            }

            $that.each(function () {
                var o = {};

                o.sidebar = $(this);

                // Save options
                o.options = options || {};

                // Get container
                o.container = $(o.options.containerSelector);
                if (o.container.length == 0) {
                    o.container = o.sidebar.parent();
                }

                // Create sticky sidebar
                o.sidebar.parents(':not(.theia-exception)').css('-webkit-transform', 'none'); // Fix for WebKit bug - https://code.google.com/p/chromium/issues/detail?id=20574
                o.sidebar.css({
                    'position': o.options.defaultPosition,
                    'overflow': 'visible',
                    // The "box-sizing" must be set to "content-box" because we set a fixed height to this element when the sticky sidebar has a fixed position.
                    '-webkit-box-sizing': 'border-box',
                    '-moz-box-sizing': 'border-box',
                    'box-sizing': 'border-box'
                });

                // Get the sticky sidebar element. If none has been found, then create one.
                o.stickySidebar = o.sidebar.find('.theiaStickySidebar');
                if (o.stickySidebar.length == 0) {
                    // Remove <script> tags, otherwise they will be run again when added to the stickySidebar.
                    var javaScriptMIMETypes = /(?:text|application)\/(?:x-)?(?:javascript|ecmascript)/i;
                    o.sidebar.find('script').filter(function (index, script) {
                        return script.type.length === 0 || script.type.match(javaScriptMIMETypes);
                    }).remove();

                    o.stickySidebar = $('<div>').addClass('theiaStickySidebar').append(o.sidebar.children());
                    o.sidebar.append(o.stickySidebar);
                }

                // Get existing top and bottom margins and paddings
                o.marginBottom = parseInt(o.sidebar.css('margin-bottom'));
                o.paddingTop = parseInt(o.sidebar.css('padding-top'));
                o.paddingBottom = parseInt(o.sidebar.css('padding-bottom'));

                // Add a temporary padding rule to check for collapsable margins.
                var collapsedTopHeight = o.stickySidebar.offset().top;
                var collapsedBottomHeight = o.stickySidebar.outerHeight();
                o.stickySidebar.css('padding-top', 1);
                o.stickySidebar.css('padding-bottom', 1);
                collapsedTopHeight -= o.stickySidebar.offset().top;
                collapsedBottomHeight = o.stickySidebar.outerHeight() - collapsedBottomHeight - collapsedTopHeight;
                if (collapsedTopHeight == 0) {
                    o.stickySidebar.css('padding-top', 0);
                    o.stickySidebarPaddingTop = 0;
                }
                else {
                    o.stickySidebarPaddingTop = 1;
                }

                if (collapsedBottomHeight == 0) {
                    o.stickySidebar.css('padding-bottom', 0);
                    o.stickySidebarPaddingBottom = 0;
                }
                else {
                    o.stickySidebarPaddingBottom = 1;
                }

                // We use this to know whether the user is scrolling up or down.
                o.previousScrollTop = null;

                // Scroll top (value) when the sidebar has fixed position.
                o.fixedScrollTop = 0;

                // Set sidebar to default values.
                resetSidebar();

                o.onScroll = function (o) {
                    // Stop if the sidebar isn't visible.
                    if (!o.stickySidebar.is(":visible")) {
                        return;
                    }

                    // Stop if the window is too small.
                    if ($('body').width() < o.options.minWidth) {
                        resetSidebar();
                        return;
                    }

                    // Stop if the sidebar width is larger than the container width (e.g. the theme is responsive and the sidebar is now below the content)
                    if (o.options.disableOnResponsiveLayouts) {
                        var sidebarWidth = o.sidebar.outerWidth(o.sidebar.css('float') == 'none');

                        if (sidebarWidth + 50 > o.container.width()) {
                            resetSidebar();
                            return;
                        }
                    }

                    var scrollTop = $(document).scrollTop();
                    var position = 'static';

                    // If the user has scrolled down enough for the sidebar to be clipped at the top, then we can consider changing its position.
                    if (scrollTop >= o.sidebar.offset().top + (o.paddingTop - o.options.additionalMarginTop)) {
                        // The top and bottom offsets, used in various calculations.
                        var offsetTop = o.paddingTop + options.additionalMarginTop;
                        var offsetBottom = o.paddingBottom + o.marginBottom + options.additionalMarginBottom;

                        // All top and bottom positions are relative to the window, not to the parent elemnts.
                        var containerTop = o.sidebar.offset().top;
                        var containerBottom = o.sidebar.offset().top + getClearedHeight(o.container);

                        // The top and bottom offsets relative to the window screen top (zero) and bottom (window height).
                        var windowOffsetTop = 0 + options.additionalMarginTop;
                        var windowOffsetBottom;

                        var sidebarSmallerThanWindow = (o.stickySidebar.outerHeight() + offsetTop + offsetBottom) < $(window).height();
                        if (sidebarSmallerThanWindow) {
                            windowOffsetBottom = windowOffsetTop + o.stickySidebar.outerHeight();
                        }
                        else {
                            windowOffsetBottom = $(window).height() - o.marginBottom - o.paddingBottom - options.additionalMarginBottom;
                        }

                        var staticLimitTop = containerTop - scrollTop + o.paddingTop;
                        var staticLimitBottom = containerBottom - scrollTop - o.paddingBottom - o.marginBottom;

                        var top = o.stickySidebar.offset().top - scrollTop;
                        var scrollTopDiff = o.previousScrollTop - scrollTop;

                        // If the sidebar position is fixed, then it won't move up or down by itself. So, we manually adjust the top coordinate.
                        if (o.stickySidebar.css('position') == 'fixed') {
                            if (o.options.sidebarBehavior == 'modern') {
                                top += scrollTopDiff;
                            }
                        }

                        if (o.options.sidebarBehavior == 'stick-to-top') {
                            top = options.additionalMarginTop;
                        }

                        if (o.options.sidebarBehavior == 'stick-to-bottom') {
                            top = windowOffsetBottom - o.stickySidebar.outerHeight();
                        }

                        if (scrollTopDiff > 0) { // If the user is scrolling up.
                            top = Math.min(top, windowOffsetTop);
                        }
                        else { // If the user is scrolling down.
                            top = Math.max(top, windowOffsetBottom - o.stickySidebar.outerHeight());
                        }

                        top = Math.max(top, staticLimitTop);

                        top = Math.min(top, staticLimitBottom - o.stickySidebar.outerHeight());

                        // If the sidebar is the same height as the container, we won't use fixed positioning.
                        var sidebarSameHeightAsContainer = o.container.height() == o.stickySidebar.outerHeight();

                        if (!sidebarSameHeightAsContainer && top == windowOffsetTop) {
                            position = 'fixed';
                        }
                        else if (!sidebarSameHeightAsContainer && top == windowOffsetBottom - o.stickySidebar.outerHeight()) {
                            position = 'fixed';
                        }
                        else if (scrollTop + top - o.sidebar.offset().top - o.paddingTop <= options.additionalMarginTop) {
                            // Stuck to the top of the page. No special behavior.
                            position = 'static';
                        }
                        else {
                            // Stuck to the bottom of the page.
                            position = 'absolute';
                        }
                    }

                    /*
                     * Performance notice: It's OK to set these CSS values at each resize/scroll, even if they don't change.
                     * It's way slower to first check if the values have changed.
                     */
                    if (position == 'fixed') {
                        var scrollLeft = $(document).scrollLeft();

                        o.stickySidebar.css({
                            'position': 'fixed',
                            'width': getWidthForObject(o.stickySidebar) + 'px',
                            'transform': 'translateY(' + top + 'px)',
                            'left': (o.sidebar.offset().left + parseInt(o.sidebar.css('padding-left')) - scrollLeft) + 'px',
                            'top': '0px'
                        });
                    }
                    else if (position == 'absolute') {
                        var css = {};

                        if (o.stickySidebar.css('position') != 'absolute') {
                            css.position = 'absolute';
                            css.transform = 'translateY(' + (scrollTop + top - o.sidebar.offset().top - o.stickySidebarPaddingTop - o.stickySidebarPaddingBottom) + 'px)';
                            css.top = '0px';
                        }

                        css.width = getWidthForObject(o.stickySidebar) + 'px';
                        css.left = '';

                        o.stickySidebar.css(css);
                    }
                    else if (position == 'static') {
                        resetSidebar();
                    }

                    if (position != 'static') {
                        if (o.options.updateSidebarHeight == true) {
                            o.sidebar.css({
                                'min-height': o.stickySidebar.outerHeight() + o.stickySidebar.offset().top - o.sidebar.offset().top + o.paddingBottom
                            });
                        }
                    }

                    o.previousScrollTop = scrollTop;
                };

                // Initialize the sidebar's position.
                o.onScroll(o);

                // Recalculate the sidebar's position on every scroll and resize.
                $(document).on('scroll.' + o.options.namespace, function (o) {
                    return function () {
                        o.onScroll(o);
                    };
                }(o));
                $(window).on('resize.' + o.options.namespace, function (o) {
                    return function () {
                        o.stickySidebar.css({'position': 'static'});
                        o.onScroll(o);
                    };
                }(o));

                // Recalculate the sidebar's position every time the sidebar changes its size.
                if (typeof ResizeSensor !== 'undefined') {
                    new ResizeSensor(o.stickySidebar[0], function (o) {
                        return function () {
                            o.onScroll(o);
                        };
                    }(o));
                }

                // Reset the sidebar to its default state
                function resetSidebar() {
                    o.fixedScrollTop = 0;
                    o.sidebar.css({
                        'min-height': '1px'
                    });
                    o.stickySidebar.css({
                        'position': 'static',
                        'width': '',
                        'transform': 'none'
                    });
                }

                // Get the height of a div as if its floated children were cleared. Note that this function fails if the floats are more than one level deep.
                function getClearedHeight(e) {
                    var height = e.height();

                    e.children().each(function () {
                        height = Math.max(height, $(this).height());
                    });

                    return height;
                }
            });
        }

        function getWidthForObject(object) {
            var width;

            try {
                width = object[0].getBoundingClientRect().width;
            }
            catch (err) {
            }

            if (typeof width === "undefined") {
                width = object.width();
            }

            return width;
        }

        return this;
    }
})(jQuery);

//# sourceMappingURL=maps/theia-sticky-sidebar.js.map


/**
@license Sticky-kit v1.1.3 | MIT | Leaf Corcoran 2015 | http://leafo.net
 */

(function() {
  var $, win;

  $ = window.jQuery;

  win = $(window);

  $.fn.stick_in_parent = function(opts) {
    var doc, elm, enable_bottoming, fn, i, inner_scrolling, len, manual_spacer, offset_top, outer_width, parent_selector, recalc_every, sticky_class;
    if (opts == null) {
      opts = {};
    }
    sticky_class = opts.sticky_class, inner_scrolling = opts.inner_scrolling, recalc_every = opts.recalc_every, parent_selector = opts.parent, offset_top = opts.offset_top, manual_spacer = opts.spacer, enable_bottoming = opts.bottoming;
    if (offset_top == null) {
      offset_top = 0;
    }
    if (parent_selector == null) {
      parent_selector = void 0;
    }
    if (inner_scrolling == null) {
      inner_scrolling = true;
    }
    if (sticky_class == null) {
      sticky_class = "is_stuck";
    }
    doc = $(document);
    if (enable_bottoming == null) {
      enable_bottoming = true;
    }
    outer_width = function(el) {
      var _el, computed, w;
      if (window.getComputedStyle) {
        _el = el[0];
        computed = window.getComputedStyle(el[0]);
        w = parseFloat(computed.getPropertyValue("width")) + parseFloat(computed.getPropertyValue("margin-left")) + parseFloat(computed.getPropertyValue("margin-right"));
        if (computed.getPropertyValue("box-sizing") !== "border-box") {
          w += parseFloat(computed.getPropertyValue("border-left-width")) + parseFloat(computed.getPropertyValue("border-right-width")) + parseFloat(computed.getPropertyValue("padding-left")) + parseFloat(computed.getPropertyValue("padding-right"));
        }
        return w;
      } else {
        return el.outerWidth(true);
      }
    };
    fn = function(elm, padding_bottom, parent_top, parent_height, top, height, el_float, detached) {
      var bottomed, detach, fixed, last_pos, last_scroll_height, offset, parent, recalc, recalc_and_tick, recalc_counter, spacer, tick;
      if (elm.data("sticky_kit")) {
        return;
      }
      elm.data("sticky_kit", true);
      last_scroll_height = doc.height();
      parent = elm.parent();
      if (parent_selector != null) {
        parent = parent.closest(parent_selector);
      }
      if (!parent.length) {
        throw "failed to find stick parent";
      }
      fixed = false;
      bottomed = false;
      spacer = manual_spacer != null ? manual_spacer && elm.closest(manual_spacer) : $("<div />");
      if (spacer) {
        spacer.css('position', elm.css('position'));
      }
      recalc = function() {
        var border_top, padding_top, restore;
        if (detached) {
          return;
        }
        last_scroll_height = doc.height();
        border_top = parseInt(parent.css("border-top-width"), 10);
        padding_top = parseInt(parent.css("padding-top"), 10);
        padding_bottom = parseInt(parent.css("padding-bottom"), 10);
        parent_top = parent.offset().top + border_top + padding_top;
        parent_height = parent.height();
        if (fixed) {
          fixed = false;
          bottomed = false;
          if (manual_spacer == null) {
            elm.insertAfter(spacer);
            spacer.detach();
          }
          elm.css({
            position: "",
            top: "",
            width: "",
            bottom: ""
          }).removeClass(sticky_class);
          restore = true;
        }
        top = elm.offset().top - (parseInt(elm.css("margin-top"), 10) || 0) - offset_top;
        height = elm.outerHeight(true);
        el_float = elm.css("float");
        if (spacer) {
          spacer.css({
            width: outer_width(elm),
            height: height,
            display: elm.css("display"),
            "vertical-align": elm.css("vertical-align"),
            "float": el_float
          });
        }
        if (restore) {
          return tick();
        }
      };
      recalc();
      if (height === parent_height) {
        return;
      }
      last_pos = void 0;
      offset = offset_top;
      recalc_counter = recalc_every;
      tick = function() {
        var css, delta, recalced, scroll, will_bottom, win_height;
        if (detached) {
          return;
        }
        recalced = false;
        if (recalc_counter != null) {
          recalc_counter -= 1;
          if (recalc_counter <= 0) {
            recalc_counter = recalc_every;
            recalc();
            recalced = true;
          }
        }
        if (!recalced && doc.height() !== last_scroll_height) {
          recalc();
          recalced = true;
        }
        scroll = win.scrollTop();
        if (last_pos != null) {
          delta = scroll - last_pos;
        }
        last_pos = scroll;
        if (fixed) {
          if (enable_bottoming) {
            will_bottom = scroll + height + offset > parent_height + parent_top;
            if (bottomed && !will_bottom) {
              bottomed = false;
              elm.css({
                position: "fixed",
                bottom: "",
                top: offset
              }).trigger("sticky_kit:unbottom");
            }
          }
          if (scroll < top) {
            fixed = false;
            offset = offset_top;
            if (manual_spacer == null) {
              if (el_float === "left" || el_float === "right") {
                elm.insertAfter(spacer);
              }
              spacer.detach();
            }
            css = {
              position: "",
              width: "",
              top: ""
            };
            elm.css(css).removeClass(sticky_class).trigger("sticky_kit:unstick");
          }
          if (inner_scrolling) {
            win_height = win.height();
            if (height + offset_top > win_height) {
              if (!bottomed) {
                offset -= delta;
                offset = Math.max(win_height - height, offset);
                offset = Math.min(offset_top, offset);
                if (fixed) {
                  elm.css({
                    top: offset + "px"
                  });
                }
              }
            }
          }
        } else {
          if (scroll > top) {
            fixed = true;
            css = {
              position: "fixed",
              top: offset
            };
            css.width = elm.css("box-sizing") === "border-box" ? elm.outerWidth() + "px" : elm.width() + "px";
            elm.css(css).addClass(sticky_class);
            if (manual_spacer == null) {
              elm.after(spacer);
              if (el_float === "left" || el_float === "right") {
                spacer.append(elm);
              }
            }
            elm.trigger("sticky_kit:stick");
          }
        }
        if (fixed && enable_bottoming) {
          if (will_bottom == null) {
            will_bottom = scroll + height + offset > parent_height + parent_top;
          }
          if (!bottomed && will_bottom) {
            bottomed = true;
            if (parent.css("position") === "static") {
              parent.css({
                position: "relative"
              });
            }
            return elm.css({
              position: "absolute",
              bottom: padding_bottom,
              top: "auto"
            }).trigger("sticky_kit:bottom");
          }
        }
      };
      recalc_and_tick = function() {
        recalc();
        return tick();
      };
      detach = function() {
        detached = true;
        win.off("touchmove", tick);
        win.off("scroll", tick);
        win.off("resize", recalc_and_tick);
        $(document.body).off("sticky_kit:recalc", recalc_and_tick);
        elm.off("sticky_kit:detach", detach);
        elm.removeData("sticky_kit");
        elm.css({
          position: "",
          bottom: "",
          top: "",
          width: ""
        });
        parent.position("position", "");
        if (fixed) {
          if (manual_spacer == null) {
            if (el_float === "left" || el_float === "right") {
              elm.insertAfter(spacer);
            }
            spacer.remove();
          }
          return elm.removeClass(sticky_class);
        }
      };
      win.on("touchmove", tick);
      win.on("scroll", tick);
      win.on("resize", recalc_and_tick);
      $(document.body).on("sticky_kit:recalc", recalc_and_tick);
      elm.on("sticky_kit:detach", detach);
      return setTimeout(tick, 0);
    };
    for (i = 0, len = this.length; i < len; i++) {
      elm = this[i];
      fn($(elm));
    }
    return this;
  };

}).call(this);

/*!
 * jQuery Selectbox plugin 0.2
 *
 * Copyright 2011-2012, Dimitar Ivanov (http://www.bulgaria-web-developers.com/projects/javascript/selectbox/)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 *
 * Date: Tue Jul 17 19:58:36 2012 +0300
 */
(function ($, undefined) {
	var PROP_NAME = 'selectbox',
		FALSE = false,
		TRUE = true;
	/**
	 * Selectbox manager.
	 * Use the singleton instance of this class, $.selectbox, to interact with the select box.
	 * Settings for (groups of) select boxes are maintained in an instance object,
	 * allowing multiple different settings on the same page
	 */
	function Selectbox() {
		this._state = [];
		this._defaults = { // Global defaults for all the select box instances
			classHolder: "sbHolder",
			classHolderDisabled: "sbHolderDisabled",
			classSelector: "sbSelector",
			classOptions: "sbOptions",
			classGroup: "sbGroup",
			classSub: "sbSub",
			classDisabled: "sbDisabled",
			classToggleOpen: "sbToggleOpen",
			classToggle: "sbToggle",
			classFocus: "sbFocus",
			speed: 200,
			effect: "slide", // "slide" or "fade"
			onChange: null, //Define a callback function when the selectbox is changed
			onOpen: null, //Define a callback function when the selectbox is open
			onClose: null //Define a callback function when the selectbox is closed
		};
	}

	$.extend(Selectbox.prototype, {
		/**
		 * Is the first field in a jQuery collection open as a selectbox
		 *
		 * @param {Object} target
		 * @return {Boolean}
		 */
		_isOpenSelectbox: function (target) {
			if (!target) {
				return FALSE;
			}
			var inst = this._getInst(target);
			return inst.isOpen;
		},
		/**
		 * Is the first field in a jQuery collection disabled as a selectbox
		 *
		 * @param {HTMLElement} target
		 * @return {Boolean}
		 */
		_isDisabledSelectbox: function (target) {
			if (!target) {
				return FALSE;
			}
			var inst = this._getInst(target);
			return inst.isDisabled;
		},
		/**
		 * Attach the select box to a jQuery selection.
		 *
		 * @param {HTMLElement} target
		 * @param {Object} settings
		 */
		_attachSelectbox: function (target, settings) {
			if (this._getInst(target)) {
				return FALSE;
			}
			var $target = $(target),
				self = this,
				inst = self._newInst($target),
				sbHolder, sbSelector, sbToggle, sbOptions,
				s = FALSE, optGroup = $target.find("optgroup"), opts = $target.find("option"), olen = opts.length;

			$target.attr("sb", inst.uid);

			$.extend(inst.settings, self._defaults, settings);
			self._state[inst.uid] = FALSE;
			$target.hide();

			function closeOthers() {
				var key, sel,
					uid = this.attr("id").split("_")[1];
				for (key in self._state) {
					if (key !== uid) {
						if (self._state.hasOwnProperty(key)) {
							sel = $("select[sb='" + key + "']")[0];
							if (sel) {
								self._closeSelectbox(sel);
							}
						}
					}
				}
			}

			sbHolder = $("<div>", {
				"id": "sbHolder_" + inst.uid,
				"class": inst.settings.classHolder,
				"tabindex": $target.attr("tabindex")
			});

			sbSelector = $("<a>", {
				"id": "sbSelector_" + inst.uid,
				"href": "#",
				"class": inst.settings.classSelector,
				"click": function (e) {
					e.preventDefault();
					closeOthers.apply($(this), []);
					var uid = $(this).attr("id").split("_")[1];
					if (self._state[uid]) {
						self._closeSelectbox(target);
					} else {
						self._openSelectbox(target);
					}
				}
			});

			sbToggle = $("<a>", {
				"id": "sbToggle_" + inst.uid,
				"href": "#",
				"class": inst.settings.classToggle,
				"click": function (e) {
					e.preventDefault();
					closeOthers.apply($(this), []);
					var uid = $(this).attr("id").split("_")[1];
					if (self._state[uid]) {
						self._closeSelectbox(target);
					} else {
						self._openSelectbox(target);
					}
				}
			});
			sbToggle.appendTo(sbHolder);

			sbOptions = $("<ul>", {
				"id": "sbOptions_" + inst.uid,
				"class": inst.settings.classOptions,
				"css": {
					"display": "none"
				}
			});

			$target.children().each(function(i) {
				var that = $(this), li, config = {};
				if (that.is("option")) {
					getOptions(that);
				} else if (that.is("optgroup")) {
					li = $("<li>");
					$("<span>", {
						"text": that.attr("label")
					}).addClass(inst.settings.classGroup).appendTo(li);
					li.appendTo(sbOptions);
					if (that.is(":disabled")) {
						config.disabled = true;
					}
					config.sub = true;
					getOptions(that.find("option"), config);
				}
			});

			function getOptions () {
				var sub = arguments[1] && arguments[1].sub ? true : false,
					disabled = arguments[1] && arguments[1].disabled ? true : false;
				arguments[0].each(function (i) {
					var that = $(this),
						li = $("<li>"),
						child;
					if (that.is(":selected")) {
						sbSelector.text(that.text());
						s = TRUE;
					}
					if (i === olen - 1) {
						li.addClass("last");
					}
					if (!that.is(":disabled") && !disabled) {
						child = $("<a>", {
							"href": "#" + that.val(),
							"rel": that.val()
						}).text(that.text()).bind("click.sb", function (e) {
							if (e && e.preventDefault) {
								e.preventDefault();
							}
							var t = sbToggle,
							 	$this = $(this),
								uid = t.attr("id").split("_")[1];
							self._changeSelectbox(target, $this.attr("rel"), $this.text());
							self._closeSelectbox(target);
						}).bind("mouseover.sb", function () {
							var $this = $(this);
							$this.parent().siblings().find("a").removeClass(inst.settings.classFocus);
							$this.addClass(inst.settings.classFocus);
						}).bind("mouseout.sb", function () {
							$(this).removeClass(inst.settings.classFocus);
						});
						if (sub) {
							child.addClass(inst.settings.classSub);
						}
						if (that.is(":selected")) {
							child.addClass(inst.settings.classFocus);
						}
						child.appendTo(li);
					} else {
						child = $("<span>", {
							"text": that.text()
						}).addClass(inst.settings.classDisabled);
						if (sub) {
							child.addClass(inst.settings.classSub);
						}
						child.appendTo(li);
					}
					li.appendTo(sbOptions);
				});
			}

			if (!s) {
				sbSelector.text(opts.first().text());
			}

			$.data(target, PROP_NAME, inst);

			sbHolder.data("uid", inst.uid).bind("keydown.sb", function (e) {
				var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0,
					$this = $(this),
					uid = $this.data("uid"),
					inst = $this.siblings("select[sb='"+uid+"']").data(PROP_NAME),
					trgt = $this.siblings(["select[sb='", uid, "']"].join("")).get(0),
					$f = $this.find("ul").find("a." + inst.settings.classFocus);
				switch (key) {
					case 37: //Arrow Left
					case 38: //Arrow Up
						if ($f.length > 0) {
							var $next;
							$("a", $this).removeClass(inst.settings.classFocus);
							$next = $f.parent().prevAll("li:has(a)").eq(0).find("a");
							if ($next.length > 0) {
								$next.addClass(inst.settings.classFocus).focus();
								$("#sbSelector_" + uid).text($next.text());
							}
						}
						break;
					case 39: //Arrow Right
					case 40: //Arrow Down
						var $next;
						$("a", $this).removeClass(inst.settings.classFocus);
						if ($f.length > 0) {
							$next = $f.parent().nextAll("li:has(a)").eq(0).find("a");
						} else {
							$next = $this.find("ul").find("a").eq(0);
						}
						if ($next.length > 0) {
							$next.addClass(inst.settings.classFocus).focus();
							$("#sbSelector_" + uid).text($next.text());
						}
						break;
					case 13: //Enter
						if ($f.length > 0) {
							self._changeSelectbox(trgt, $f.attr("rel"), $f.text());
						}
						self._closeSelectbox(trgt);
						break;
					case 9: //Tab
						if (trgt) {
							var inst = self._getInst(trgt);
							if (inst/* && inst.isOpen*/) {
								if ($f.length > 0) {
									self._changeSelectbox(trgt, $f.attr("rel"), $f.text());
								}
								self._closeSelectbox(trgt);
							}
						}
						var i = parseInt($this.attr("tabindex"), 10);
						if (!e.shiftKey) {
							i++;
						} else {
							i--;
						}
						$("*[tabindex='" + i + "']").focus();
						break;
					case 27: //Escape
						self._closeSelectbox(trgt);
						break;
				}
				e.stopPropagation();
				return false;
			}).delegate("a", "mouseover", function (e) {
				$(this).addClass(inst.settings.classFocus);
			}).delegate("a", "mouseout", function (e) {
				$(this).removeClass(inst.settings.classFocus);
			});

			sbSelector.appendTo(sbHolder);
			sbOptions.appendTo(sbHolder);
			sbHolder.insertAfter($target);


			$([".", inst.settings.classHolder, ", .", inst.settings.classSelector].join("")).mousedown(function(e) {
				e.stopPropagation();
			});
		},
		/**
		 * Remove the selectbox functionality completely. This will return the element back to its pre-init state.
		 *
		 * @param {HTMLElement} target
		 */
		_detachSelectbox: function (target) {
			var inst = this._getInst(target);
			if (!inst) {
				return FALSE;
			}
			$("#sbHolder_" + inst.uid).remove();
			$.data(target, PROP_NAME, null);
			$(target).show();
		},
		/**
		 * Change selected attribute of the selectbox.
		 *
		 * @param {HTMLElement} target
		 * @param {String} value
		 * @param {String} text
		 */
		_changeSelectbox: function (target, value, text) {
			var onChange,
				inst = this._getInst(target);
			if (inst) {
				onChange = this._get(inst, 'onChange');
				$("#sbSelector_" + inst.uid).text(text);
			}
			value = value.replace(/\'/g, "\\'");
			$(target).find("option[value='" + value + "']").attr("selected", TRUE);
			if (inst && onChange) {
				onChange.apply((inst.input ? inst.input[0] : null), [value, inst]);
			} else if (inst && inst.input) {
				inst.input.trigger('change');
			}
		},
		/**
		 * Enable the selectbox.
		 *
		 * @param {HTMLElement} target
		 */
		_enableSelectbox: function (target) {
			var inst = this._getInst(target);
			if (!inst || !inst.isDisabled) {
				return FALSE;
			}
			$("#sbHolder_" + inst.uid).removeClass(inst.settings.classHolderDisabled);
			inst.isDisabled = FALSE;
			$.data(target, PROP_NAME, inst);
		},
		/**
		 * Disable the selectbox.
		 *
		 * @param {HTMLElement} target
		 */
		_disableSelectbox: function (target) {
			var inst = this._getInst(target);
			if (!inst || inst.isDisabled) {
				return FALSE;
			}
			$("#sbHolder_" + inst.uid).addClass(inst.settings.classHolderDisabled);
			inst.isDisabled = TRUE;
			$.data(target, PROP_NAME, inst);
		},
		/**
		 * Get or set any selectbox option. If no value is specified, will act as a getter.
		 *
		 * @param {HTMLElement} target
		 * @param {String} name
		 * @param {Object} value
		 */
		_optionSelectbox: function (target, name, value) {
			var inst = this._getInst(target);
			if (!inst) {
				return FALSE;
			}
			//TODO check name
			inst[name] = value;
			$.data(target, PROP_NAME, inst);
		},
		/**
		 * Call up attached selectbox
		 *
		 * @param {HTMLElement} target
		 */
		_openSelectbox: function (target) {
			var inst = this._getInst(target);
			//if (!inst || this._state[inst.uid] || inst.isDisabled) {
			if (!inst || inst.isOpen || inst.isDisabled) {
				return;
			}
			var	el = $("#sbOptions_" + inst.uid),
				viewportHeight = parseInt($(window).height(), 10),
				offset = $("#sbHolder_" + inst.uid).offset(),
				scrollTop = $(window).scrollTop(),
				height = el.prev().height(),
				diff = viewportHeight - (offset.top - scrollTop) - height / 2,
				onOpen = this._get(inst, 'onOpen');
			el.css({
				"top": height + "px",
				"maxHeight": (diff - height) + "px"
			});
			inst.settings.effect === "fade" ? el.fadeIn(inst.settings.speed) : el.slideDown(inst.settings.speed);
			$("#sbToggle_" + inst.uid).addClass(inst.settings.classToggleOpen);
			this._state[inst.uid] = TRUE;
			inst.isOpen = TRUE;
			if (onOpen) {
				onOpen.apply((inst.input ? inst.input[0] : null), [inst]);
			}
			$.data(target, PROP_NAME, inst);
		},
		/**
		 * Close opened selectbox
		 *
		 * @param {HTMLElement} target
		 */
		_closeSelectbox: function (target) {
			var inst = this._getInst(target);
			//if (!inst || !this._state[inst.uid]) {
			if (!inst || !inst.isOpen) {
				return;
			}
			var onClose = this._get(inst, 'onClose');
			inst.settings.effect === "fade" ? $("#sbOptions_" + inst.uid).fadeOut(inst.settings.speed) : $("#sbOptions_" + inst.uid).slideUp(inst.settings.speed);
			$("#sbToggle_" + inst.uid).removeClass(inst.settings.classToggleOpen);
			this._state[inst.uid] = FALSE;
			inst.isOpen = FALSE;
			if (onClose) {
				onClose.apply((inst.input ? inst.input[0] : null), [inst]);
			}
			$.data(target, PROP_NAME, inst);
		},
		/**
		 * Create a new instance object
		 *
		 * @param {HTMLElement} target
		 * @return {Object}
		 */
		_newInst: function(target) {
			var id = target[0].id.replace(/([^A-Za-z0-9_-])/g, '\\\\$1');
			return {
				id: id,
				input: target,
				uid: Math.floor(Math.random() * 99999999),
				isOpen: FALSE,
				isDisabled: FALSE,
				settings: {}
			};
		},
		/**
		 * Retrieve the instance data for the target control.
		 *
		 * @param {HTMLElement} target
		 * @return {Object} - the associated instance data
		 * @throws error if a jQuery problem getting data
		 */
		_getInst: function(target) {
			try {
				return $.data(target, PROP_NAME);
			}
			catch (err) {
				throw 'Missing instance data for this selectbox';
			}
		},
		/**
		 * Get a setting value, defaulting if necessary
		 *
		 * @param {Object} inst
		 * @param {String} name
		 * @return {Mixed}
		 */
		_get: function(inst, name) {
			return inst.settings[name] !== undefined ? inst.settings[name] : this._defaults[name];
		}
	});

	/**
	 * Invoke the selectbox functionality.
	 *
	 * @param {Object|String} options
	 * @return {Object}
	 */
	$.fn.selectbox = function (options) {

		var otherArgs = Array.prototype.slice.call(arguments, 1);
		if (typeof options == 'string' && options == 'isDisabled') {
			return $.selectbox['_' + options + 'Selectbox'].apply($.selectbox, [this[0]].concat(otherArgs));
		}

		if (options == 'option' && arguments.length == 2 && typeof arguments[1] == 'string') {
			return $.selectbox['_' + options + 'Selectbox'].apply($.selectbox, [this[0]].concat(otherArgs));
		}

		return this.each(function() {
			typeof options == 'string' ?
				$.selectbox['_' + options + 'Selectbox'].apply($.selectbox, [this].concat(otherArgs)) :
				$.selectbox._attachSelectbox(this, options);
		});
	};

	$.selectbox = new Selectbox(); // singleton instance
	$.selectbox.version = "0.2";
})(jQuery);


/**
	 * Date Dropper
*/

(function($) {
	var
		// CSS EVENT DETECT
		csse = {
			t : 'transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd',
			a : 'webkitAnimationEnd mozAnimationEnd oAnimationEnd oanimationend animationend'
		},
		// I18N
		i18n = {
			'en' : {
				name : 'English',
				gregorian : false,
				months : {
					short: [
						'Jan',
						'Feb',
						'Mar',
						'Apr',
						'May',
						'June',
						'July',
						'Aug',
						'Sept',
						'Oct',
						'Nov',
						'Dec'
					],
					full : [
						'January',
						'February',
						'March',
						'April',
						'May',
						'June',
						'July',
						'August',
						'September',
						'October',
						'November',
						'December'
					]
				},
				weekdays : {
					short : [
						'S',
						'M',
						'T',
						'W',
						'T',
						'F',
						'S'
					],
					full : [
						'Sunday',
						'Monday',
						'Tuesday',
						'Wednesday',
						'Thursday',
						'Friday',
						'Saturday'
					]
				}
			},
			'ka' : {
				name : 'Georgian',
				gregorian : false,
				months : {
					short: [
						'იან',
						'თებ',
						'მარტ',
						'აპრ',
						'მაი',
						'ივნ',
						'ივლ',
						'აგვ',
						'სექტ',
						'ოქტ',
						'ნოემბ',
						'დეკ'
					],
					full : [
						'იანვარი',
						'თებერვალი',
						'მარტი',
						'აპრილი',
						'მაისი',
						'ივნისი',
						'ივლისი',
						'აგვისტო',
						'სექტემბერი',
						'ოქტომბერი',
						'ნოემბერი',
						'დეკემბერი'
					]
				},
				weekdays : {
					short : [
						'კვ',
						'ორ',
						'სამ',
						'ოთხ',
						'ხუთ',
						'პარ',
						'შაბ'
					],
					full : [
						'კვირა',
						'ორშაბათი',
						'სამშაბათი',
						'ოთხშაბათი',
						'ხუთშაბათი',
						'პარასკევი',
						'შაბათი'
					]
				}
			},//
			'it' : {
				name : 'Italiano',
				gregorian : true,
				months : {
					short: [
						'Gen',
						'Feb',
						'Mar',
						'Apr',
						'Mag',
						'Giu',
						'Lug',
						'Ago',
						'Set',
						'Ott',
						'Nov',
						'Dic'
					],
					full : [
						'Gennaio',
						'Febbraio',
						'Marzo',
						'Aprile',
						'Maggio',
						'Giugno',
						'Luglio',
						'Agosto',
						'Settembre',
						'Ottobre',
						'Novembre',
						'Dicembre'
					]
				},
				weekdays : {
					short : [
						'D',
						'L',
						'M',
						'M',
						'G',
						'V',
						'S'
					],
					full : [
						'Domenica',
						'Lunedì',
						'Martedì',
						'Mercoledì',
						'Giovedì',
						'Venerdì',
						'Sabato'
					]
				}
			},
			'fr' : {
				name : 'Français',
				gregorian : true,
				months : {
					short: [
						'Jan',
						'Fév',
						'Mar',
						'Avr',
						'Mai',
						'Jui',
						'Jui',
						'Aoû',
						'Sep',
						'Oct',
						'Nov',
						'Déc'
					],
					full : [
						'Janvier',
						'Février',
						'Mars',
						'Avril',
						'Mai',
						'Juin',
						'Juillet',
						'Août',
						'Septembre',
						'Octobre',
						'Novembre',
						'Décembre'
					]
				},
				weekdays : {
					short : [
						'D',
						'L',
						'M',
						'M',
						'J',
						'V',
						'S'
					],
					full : [
						'Dimanche',
						'Lundi',
						'Mardi',
						'Mercredi',
						'Jeudi',
						'Vendredi',
						'Samedi'
					]
				}
			},
			'zh' : {
				name : '中文',
				gregorian : true,
				months : {
					short: [
						'一月',
						'二月',
						'三月',
						'四月',
						'五月',
						'六月',
						'七月',
						'八月',
						'九月',
						'十月',
						'十一月',
						'十二月'
					],
					full : [
						'一月',
						'二月',
						'三月',
						'四月',
						'五月',
						'六月',
						'七月',
						'八月',
						'九月',
						'十月',
						'十一月',
						'十二月'
					]
				},
				weekdays : {
					short : [
						'天',
						'一',
						'二',
						'三',
						'四',
						'五',
						'六'
					],
					full : [
						'星期天',
						'星期一',
						'星期二',
						'星期三',
						'星期四',
						'星期五',
						'星期六'
					]
				}
			},
			'ar' : {
				name : 'العَرَبِيَّة',
				gregorian : false,
				months : {
					short: [
						'جانفي',
						'فيفري',
						'مارس',
						'أفريل',
						'ماي',
						'جوان',
						'جويلية',
						'أوت',
						'سبتمبر',
						'أكتوبر',
						'نوفمبر',
						'ديسمبر'
					],
					full : [
						'جانفي',
						'فيفري',
						'مارس',
						'أفريل',
						'ماي',
						'جوان',
						'جويلية',
						'أوت',
						'سبتمبر',
						'أكتوبر',
						'نوفمبر',
						'ديسمبر'
					]
				},
				weekdays : {
					short : [
						'S',
						'M',
						'T',
						'W',
						'T',
						'F',
						'S'
					],
					full : [
						'الأحد',
						'الإثنين',
						'الثلثاء',
						'الأربعاء',
						'الخميس',
						'الجمعة',
						'السبت'
					]
				}
			},
			'fa' : {
				name : 'فارسی',
				gregorian : false,
				months : {
					short: [
						'ژانویه',
						'فووریه',
						'مارچ',
						'آپریل',
						'می',
						'جون',
						'جولای',
						'آگوست',
						'سپتامبر',
						'اکتبر',
						'نوامبر',
						'دسامبر'
					],
					full : [
						'ژانویه',
						'فووریه',
						'مارچ',
						'آپریل',
						'می',
						'جون',
						'جولای',
						'آگوست',
						'سپتامبر',
						'اکتبر',
						'نوامبر',
						'دسامبر'
					]
				},
				weekdays : {
					short : [
						'S',
						'M',
						'T',
						'W',
						'T',
						'F',
						'S'
					],
					full : [
						'یکشنبه',
						'دوشنبه',
						'سه شنبه',
						'چهارشنبه',
						'پنج شنبه',
						'جمعه',
						'شنبه'
					]
				}
			},
			'hu' : {
				name : 'Hungarian',
				gregorian : true,
				months : {
					short: [
						"jan",
						"feb",
						"már",
						"ápr",
						"máj",
						"jún",
						"júl",
						"aug",
						"sze",
						"okt",
						"nov",
						"dec"
					],
					full : [
						"január",
						"február",
						"március",
						"április",
						"május",
						"június",
						"július",
						"augusztus",
						"szeptember",
						"október",
						"november",
						"december"
					]
				},
				weekdays : {
					short : [
						'v',
						'h',
						'k',
						's',
						'c',
						'p',
						's'
					],
					full : [
						'vasárnap',
						'hétfő',
						'kedd',
						'szerda',
						'csütörtök',
						'péntek',
						'szombat'
					]
				}
			},
			'gr' : {
				name : 'Ελληνικά',
				gregorian : true,
				months : {
					short: [
						"Ιαν",
						"Φεβ",
						"Μάρ",
						"Απρ",
						"Μάι",
						"Ιούν",
						"Ιούλ",
						"Αύγ",
						"Σεπ",
						"Οκτ",
						"Νοέ",
						"Δεκ"
					],
					full : [
						"Ιανουάριος",
						"Φεβρουάριος",
						"Μάρτιος",
						"Απρίλιος",
						"Μάιος",
						"Ιούνιος",
						"Ιούλιος",
						"Αύγουστος",
						"Σεπτέμβριος",
						"Οκτώβριος",
						"Νοέμβριος",
						"Δεκέμβριος"
					]
				},
				weekdays : {
					short : [
						'Κ',
						'Δ',
						'Τ',
						'Τ',
						'Π',
						'Π',
						'Σ'
					],
					full : [
						'Κυριακή',
						'Δευτέρα',
						'Τρίτη',
						'Τετάρτη',
						'Πέμπτη',
						'Παρασκευή',
						'Σάββατο'
					]
				}
			},
			'es' : {
				name : 'Español',
				gregorian : true,
				months : {
					short: [
						"Ene",
						"Feb",
						"Mar",
						"Abr",
						"May",
						"Jun",
						"Jul",
						"Ago",
						"Sep",
						"Oct",
						"Nov",
						"Dic"
					],
					full : [
						"Enero",
						"Febrero",
						"Marzo",
						"Abril",
						"Mayo",
						"Junio",
						"Julio",
						"Agosto",
						"Septiembre",
						"Octubre",
						"Noviembre",
						"Diciembre"
					]
				},
				weekdays : {
					short : [
						'D',
						'L',
						'M',
						'X',
						'J',
						'V',
						'S'
					],
					full : [
						'Domingo',
						'Lunes',
						'Martes',
						'Miércoles',
						'Jueves',
						'Viernes',
						'Sábado'
					]
				}
			},
			'da' : {
				name : 'Dansk',
				gregorian : true,
				months : {
					short: [
						"jan",
						"feb",
						"mar",
						"apr",
						"maj",
						"jun",
						"jul",
						"aug",
						"sep",
						"okt",
						"nov",
						"dec"
					],
					full : [
						"januar",
						"februar",
						"marts",
						"april",
						"maj",
						"juni",
						"juli",
						"august",
						"september",
						"oktober",
						"november",
						"december"
					]
				},
				weekdays : {
					short : [
						's',
						'm',
						't',
						'o',
						't',
						'f',
						'l'
					],
					full : [
						'søndag',
						'mandag',
						'tirsdag',
						'onsdag',
						'torsdag',
						'fredag',
						'lørdag'
					]
				}
			},
			'de' : {
				name : 'Deutsch',
				gregorian : true,
				months : {
					short: [
						"Jan",
						"Feb",
						"Mär",
						"Apr",
						"Mai",
						"Jun",
						"Jul",
						"Aug",
						"Sep",
						"Okt",
						"Nov",
						"Dez"
					],
					full : [
						"Januar",
						"Februar",
						"März",
						"April",
						"Mai",
						"Juni",
						"Juli",
						"August",
						"September",
						"Oktober",
						"November",
						"Dezember"
					]
				},
				weekdays : {
					short : [
						'S',
						'M',
						'D',
						'M',
						'D',
						'F',
						'S'
					],
					full : [
						'Sonntag',
						'Montag',
						'Dienstag',
						'Mittwoch',
						'Donnerstag',
						'Freitag',
						'Samstag'
					]
				}
			},
			'nl' : {
				name : 'Nederlands',
				gregorian : true,
				months : {
					short: [
						"jan",
						"feb",
						"maa",
						"apr",
						"mei",
						"jun",
						"jul",
						"aug",
						"sep",
						"okt",
						"nov",
						"dec"
					],
					full : [
						"januari",
						"februari",
						"maart",
						"april",
						"mei",
						"juni",
						"juli",
						"augustus",
						"september",
						"oktober",
						"november",
						"december"
					]
				},
				weekdays : {
					short : [
						'z',
						'm',
						'd',
						'w',
						'd',
						'v',
						'z'
					],
					full : [
						'zondag',
						'maandag',
						'dinsdag',
						'woensdag',
						'donderdag',
						'vrijdag',
						'zaterdag'
					]
				}
			},
			'pl' : {
				name : 'język polski',
				gregorian : true,
				months : {
					short: [
						"sty",
						"lut",
						"mar",
						"kwi",
						"maj",
						"cze",
						"lip",
						"sie",
						"wrz",
						"paź",
						"lis",
						"gru"
					],
					full : [
						"styczeń",
						"luty",
						"marzec",
						"kwiecień",
						"maj",
						"czerwiec",
						"lipiec",
						"sierpień",
						"wrzesień",
						"październik",
						"listopad",
						"grudzień"
					]
				},
				weekdays : {
					short : [
						'n',
						'p',
						'w',
						'ś',
						'c',
						'p',
						's'
					],
					full : [
						'niedziela',
						'poniedziałek',
						'wtorek',
						'środa',
						'czwartek',
						'piątek',
						'sobota'
					]
				}
			},
			'pt' : {
				name : 'Português',
				gregorian : true,
				months : {
					short: [
						"Janeiro",
						"Fevereiro",
						"Março",
						"Abril",
						"Maio",
						"Junho",
						"Julho",
						"Agosto",
						"Setembro",
						"Outubro",
						"Novembro",
						"Dezembro"
					],
					full : [
						"Janeiro",
						"Fevereiro",
						"Março",
						"Abril",
						"Maio",
						"Junho",
						"Julho",
						"Agosto",
						"Setembro",
						"Outubro",
						"Novembro",
						"Dezembro"
					]
				},
				weekdays : {
					short : [
						"D",
						"S",
						"T",
						"Q",
						"Q",
						"S",
						"S"
					],
					full : [
						"Domingo",
						"Segunda",
						"Terça",
						"Quarta",
						"Quinta",
						"Sexta",
						"Sábado"
					]
				}
			},
			'si' : {
				name : 'Slovenščina',
				gregorian : true,
				months : {
					short: [
						"jan",
						"feb",
						"mar",
						"apr",
						"maj",
						"jun",
						"jul",
						"avg",
						"sep",
						"okt",
						"nov",
						"dec"
					],
					full : [
						"januar",
						"februar",
						"marec",
						"april",
						"maj",
						"junij",
						"julij",
						"avgust",
						"september",
						"oktober",
						"november",
						"december"
					]
				},
				weekdays : {
					short : [
						'n',
						'p',
						't',
						's',
						'č',
						'p',
						's'
					],
					full : [
						'nedelja',
						'ponedeljek',
						'torek',
						'sreda',
						'četrtek',
						'petek',
						'sobota'
					]
				}
			},
			'uk' : {
				name : 'українська мова',
				gregorian : true,
				months : {
					short: [
						"січень",
						"лютий",
						"березень",
						"квітень",
						"травень",
						"червень",
						"липень",
						"серпень",
						"вересень",
						"жовтень",
						"листопад",
						"грудень"
					],
					full : [
						"січень",
						"лютий",
						"березень",
						"квітень",
						"травень",
						"червень",
						"липень",
						"серпень",
						"вересень",
						"жовтень",
						"листопад",
						"грудень"
					]
				},
				weekdays : {
					short : [
						'н',
						'п',
						'в',
						'с',
						'ч',
						'п',
						'с'
					],
					full : [
						'неділя',
						'понеділок',
						'вівторок',
						'середа',
						'четвер',
						'п\'ятниця',
						'субота'
					]
				}
			},
			'ru' : {
				name : 'русский язык',
				gregorian : true,
				months : {
					short: [
						"январь",
						"февраль",
						"март",
						"апрель",
						"май",
						"июнь",
						"июль",
						"август",
						"сентябрь",
						"октябрь",
						"ноябрь",
						"декабрь"
					],
					full : [
						"январь",
						"февраль",
						"март",
						"апрель",
						"май",
						"июнь",
						"июль",
						"август",
						"сентябрь",
						"октябрь",
						"ноябрь",
						"декабрь"
					]
				},
				weekdays : {
					short : [
						'в',
						'п',
						'в',
						'с',
						'ч',
						'п',
						'с'
					],
					full : [
						'воскресенье',
						'понедельник',
						'вторник',
						'среда',
						'четверг',
						'пятница',
						'суббота'
					]
				}
			},
			'tr' : {
				name : 'Türkçe',
				gregorian : true,
				months : {
					short: [
						"Oca",
						"Şub",
						"Mar",
						"Nis",
						"May",
						"Haz",
						"Tem",
						"Ağu",
						"Eyl",
						"Eki",
						"Kas",
						"Ara"
					],
					full : [
						"Ocak",
						"Şubat",
						"Mart",
						"Nisan",
						"Mayıs",
						"Haziran",
						"Temmuz",
						"Ağustos",
						"Eylül",
						"Ekim",
						"Kasım",
						"Aralık"
					]
				},
				weekdays : {
					short : [
						'P',
						'P',
						'S',
						'Ç',
						'P',
						'C',
						'C'
					],
					full : [
						'Pazar',
						'Pazartesi',
						'Sali',
						'Çarşamba',
						'Perşembe',
						'Cuma',
						'Cumartesi'
					]
				}
			},
			'ko' : {
				name : '조선말',
				gregorian : true,
				months : {
					short: [
						"1월",
						"2월",
						"3월",
						"4월",
						"5월",
						"6월",
						"7월",
						"8월",
						"9월",
						"10월",
						"11월",
						"12월"
					],
					full : [
						"1월",
						"2월",
						"3월",
						"4월",
						"5월",
						"6월",
						"7월",
						"8월",
						"9월",
						"10월",
						"11월",
						"12월"
					]
				},
				weekdays : {
					short : [
						'일',
						'월',
						'화',
						'수',
						'목',
						'금',
						'토'
					],
					full : [
						'일요일',
						'월요일',
						'화요일',
						'수요일',
						'목요일',
						'금요일',
						'토요일'
					]
				}
			},
			'fi' : {
				name : 'suomen kieli',
				gregorian : true,
				months : {
					short: [
						"Tam",
						"Hel",
						"Maa",
						"Huh",
						"Tou",
						"Kes",
						"Hei",
						"Elo",
						"Syy",
						"Lok",
						"Mar",
						"Jou"
					],
					full : [
						"Tammikuu",
						"Helmikuu",
						"Maaliskuu",
						"Huhtikuu",
						"Toukokuu",
						"Kesäkuu",
						"Heinäkuu",
						"Elokuu",
						"Syyskuu",
						"Lokakuu",
						"Marraskuu",
						"Joulukuu"
					]
				},
				weekdays : {
					short : [
						'S',
						'M',
						'T',
						'K',
						'T',
						'P',
						'L'
					],
					full : [
						'Sunnuntai',
						'Maanantai',
						'Tiistai',
						'Keskiviikko',
						'Torstai',
						'Perjantai',
						'Lauantai'
					]
				}
			},
			'vi':{
				name:'Tiếng việt',
				gregorian:false,
				months:{
					short:[
						'Th.01',
						'Th.02',
						'Th.03',
						'Th.04',
						'Th.05',
						'Th.06',
						'Th.07',
						'Th.08',
						'Th.09',
						'Th.10',
						'Th.11',
						'Th.12'
					],
					full:[
						'Tháng 01',
						'Tháng 02',
						'Tháng 03',
						'Tháng 04',
						'Tháng 05',
						'Tháng 06',
						'Tháng 07',
						'Tháng 08',
						'Tháng 09',
						'Tháng 10',
						'Tháng 11',
						'Tháng 12'
					]
				},
				weekdays:{
					short:[
						'CN',
						'T2',
						'T3',
						'T4',
						'T5',
						'T6',
						'T7'
					],
					full:[
						'Chủ nhật',
						'Thứ hai',
						'Thứ ba',
						'Thứ tư',
						'Thứ năm',
						'Thứ sáu',
						'Thứ bảy'
					]
				}
			}
		},

		// MAIN VARS

		pickers = {},
		picker = null,
		picker_ctrl = false,
		pick_dragged = null,
		pick_drag_offset = null,
		pick_drag_temp = null,

		// CHECK FUNCTIONS

		is_click = false,
		is_ie = function() {
			var
				n = navigator.userAgent.toLowerCase();
			return (n.indexOf('msie') != -1) ? parseInt(n.split('msie')[1]) : false;
		},
		is_touch = function() {
			if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
				return true;
			else
				return false;
		},
		is_fx_mobile = function() {
			if(picker&&pickers[picker.id].fx&&!pickers[picker.id].fxmobile) {
				if($(window).width()<480)
					picker.element.removeClass('picker-fxs');
				else
					picker.element.addClass('picker-fxs')
			}
		},
		is_jumpable = function() {
			if( pickers[picker.id].jump >= pickers[picker.id].key.y.max - pickers[picker.id].key.y.min )
				return false;
			else
				return true;
		},
		is_locked = function() {
			var
				unix_current = get_unix(get_current_full()),
				unix_today = get_unix(get_today_full());

			if(pickers[picker.id].lock) {
				if(pickers[picker.id].lock=='from') {
					if(unix_current<unix_today) {
						picker_alrt();
						picker.element.addClass('picker-lkd');
						return true;
					}
					else {
						picker.element.removeClass('picker-lkd');
						return false;
					}
				}
				if(pickers[picker.id].lock=='to') {
					if(unix_current>unix_today) {
						picker_alrt();
						picker.element.addClass('picker-lkd');
						return true;
					}
					else {
						picker.element.removeClass('picker-lkd');
						return false;
					}
				}
			}

			if(pickers[picker.id].disabledays) {
				if(pickers[picker.id].disabledays.indexOf(unix_current) != -1) {
					picker_alrt();
					picker.element.addClass('picker-lkd');
					return true;
				}
				else {
					picker.element.removeClass('picker-lkd');
					return false;
				}
			}
		},
		is_int = function(n) {
			return n % 1 === 0;
		},
		is_date = function(value) {
			var
				format = /(^\d{1,4}[\.|\\/|-]\d{1,2}[\.|\\/|-]\d{1,4})(\s*(?:0?[1-9]:[0-5]|1(?=[012])\d:[0-5])\d\s*[ap]m)?$/;
			return format.test(value);
		},

		// REST FUNCTIONS

		get_current = function(k){
			return parseInt(pickers[picker.id].key[k].current);
		},
		get_today = function(k){
			return parseInt(pickers[picker.id].key[k].today);
		},
		get_today_full = function() {
			return get_today('m')+'/'+get_today('d')+'/'+get_today('y');
		},
		get_current_full = function() {
			return get_current('m')+'/'+get_current('d')+'/'+get_current('y');
		},
		get_jumped = function(k,val) {
			var
				a = [],
				key_values = pickers[picker.id].key[k];
			for (var i = key_values.min; i <= key_values.max; i++)
				if (i%val == 0)
					a.push(i);
			return a;
		},
		get_closest_jumped = function(int,arr) {
			var c = arr[0];
			var d = Math.abs (int - c);
			for (var i = 0; i < arr.length; i++) {
				var n = Math.abs (int - arr[i]);
				if (n < d) {
					d = n;
					c = arr[i];
				}
			}
			return c;
		},
		get_clear = function(k,n){
			var
				key_values = pickers[picker.id].key[k];
			if( n > key_values.max )
				return get_clear( k , (n-key_values.max)+(key_values.min-1) );
			else if( n < key_values.min )
				return get_clear( k , (n+1) + (key_values.max - key_values.min));
			else
				return n;
		},
		get_days_array = function() {
			if(i18n[pickers[picker.id].lang].gregorian)
				return [1,2,3,4,5,6,0];
			else
				return [0,1,2,3,4,5,6];
		},
		get_ul = function(k) {
			return get_picker_els('ul.pick[data-k="'+k+'"]');
		},
		get_eq = function(k,d) {
			ul = get_ul(k);
			var
				o = [];

			ul.find('li').each(function(){
				o.push($(this).attr('value'));
			});

			if(d=='last')
				return o[o.length-1];
			else
				return o[0];

		},
		get_picker_els = function(el) {
			if(picker)
				return picker.element.find(el);
		},
		get_unix = function(d) {
			return Date.parse(d) / 1000;
		},

		// RENDER FUNCTIONS

		picker_large_onoff = function() {
			if(pickers[picker.id].large) {
				picker.element.toggleClass('picker-lg');
				picker_render_calendar();
			}
		},
		picker_translate_onoff = function() {
			get_picker_els('ul.pick.pick-l').toggleClass('visible');
		},
		picker_offset = function(){
			if(!picker.element.hasClass('picker-modal')){
				var
					input = picker.input,
					left = input.offset().left + input.outerWidth()/2,
					top = input.offset().top + input.outerHeight();
				picker.element.css({
					'left' : left,
					'top' : top
				});
			}
		},
		picker_translate = function(v) {
			pickers[picker.id].lang = Object.keys(i18n)[v];
			picker_set_lang();
			picker_set();
		},
		picker_set_lang = function() {
			var
				picker_day_offset = get_days_array();
			get_picker_els('.pick-lg .pick-lg-h li').each(function(i){
				$(this).html(i18n[pickers[picker.id].lang].weekdays.short[picker_day_offset[i]]);
			});
			get_picker_els('ul.pick.pick-m li').each(function(){
				$(this).html(i18n[pickers[picker.id].lang].months.short[$(this).attr('value')-1]);
			});
		},
		picker_show = function() {
			picker.element.addClass('picker-focus');
		},
		picker_hide = function() {
			if(!is_locked()) {
				picker.element.removeClass('picker-focus');
				if(picker.element.hasClass('picker-modal'))
					$('.picker-modal-overlay').addClass('tohide');
				picker = null;
			}
			picker_ctrl = false;
		},
		picker_render_ul = function(k){
			var
				ul = get_ul(k),
				key_values = pickers[picker.id].key[k];

			//CURRENT VALUE
			pickers[picker.id].key[k].current = key_values.today < key_values.min && key_values.min || key_values.today;

			for (i = key_values.min; i <= key_values.max; i++) {
				var
					html = i;

				if(k=='m')
					html = i18n[pickers[picker.id].lang].months.short[i-1];
				if(k=='l')
					html = i18n[Object.keys(i18n)[i]].name;

				html += k=='d' ? '<span></span>' : '';

				$('<li>', {
					value: i,
					html: html
				})
				.appendTo(ul)
			}

			//PREV BUTTON
			$('<div>', {
				class: 'pick-arw pick-arw-s1 pick-arw-l',
				html: $('<i>', {
					class: 'pick-i-l'
				})
			})
			.appendTo(ul);

			//NEXT BUTTON
			$('<div>', {
				class: 'pick-arw pick-arw-s1 pick-arw-r',
				html: $('<i>', {
					class: 'pick-i-r'
				})
			})
			.appendTo(ul);

			if(k=='y') {

				//PREV BUTTON
				$('<div>', {
					class: 'pick-arw pick-arw-s2 pick-arw-l',
					html: $('<i>', {
						class: 'pick-i-l'
					})
				})
				.appendTo(ul);

				//NEXT BUTTON
				$('<div>', {
					class: 'pick-arw pick-arw-s2 pick-arw-r',
					html: $('<i>', {
						class: 'pick-i-r'
					})
				})
				.appendTo(ul);

			}

			picker_ul_transition(k,get_current(k));

		},
		picker_render_calendar = function() {

			var
				index = 0,
				w = get_picker_els('.pick-lg-b');

			w.find('li')
			.empty()
			.removeClass('pick-n pick-b pick-a pick-v pick-lk pick-sl pick-h')
			.attr('data-value','');

			var
				_C = new Date(get_current_full()),
				_S = new Date(get_current_full()),
				_L = new Date(get_current_full()),
				_NUM = function(d){
					var
						m = d.getMonth(),
						y = d.getFullYear();
					var l = ((y % 4) == 0 && ((y % 100) != 0 || (y % 400) == 0));
					return [31, (l ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
				};

			_L.setMonth(_L.getMonth()-1);
			_S.setDate(1);

			var
				o = _S.getDay()-1;
				if(o<0)
					o = 6;
				if(i18n[pickers[picker.id].lang].gregorian) {
					o--;
					if(o<0)
						o=6;
				}

			//before
			for(var i = _NUM(_L)-o ; i <= _NUM(_L) ; i++) {
				w.find('li').eq(index)
				.html(i)
				.addClass('pick-b pick-n pick-h');
				index++;
			}
			//current
			for(var i = 1 ; i <= _NUM(_S) ; i++) {
				w.find('li').eq(index)
				.html(i)
				.addClass('pick-n pick-v')
				.attr('data-value',i);
				index++;
			}
			//after
			if(w.find('li.pick-n').length < 42) {
				var
					e = 42 - w.find('li.pick-n').length;
				for(var i = 1 ; i <= e; i++) {
					w.find('li').eq(index).html(i)
					.addClass('pick-a pick-n pick-h');
					index++;
				}
			}
			if(pickers[picker.id].lock) {
				if(pickers[picker.id].lock==='from') {
					if(get_current('y')<=get_today('y')) {
						if(get_current('m')==get_today('m')) {
							get_picker_els('.pick-lg .pick-lg-b li.pick-v[data-value="'+get_today('d')+'"]')
							.prevAll('li')
							.addClass('pick-lk')
						}
						else {
							if(get_current('m')<get_today('m')) {
								get_picker_els('.pick-lg .pick-lg-b li')
								.addClass('pick-lk')
							}
							else if(get_current('m')>get_today('m')&&get_current('y')<get_today('y')) {
								get_picker_els('.pick-lg .pick-lg-b li')
								.addClass('pick-lk')
							}
						}
					}
				}
				else {
					if(get_current('y')>=get_today('y')) {
						if(get_current('m')==get_today('m')) {
							get_picker_els('.pick-lg .pick-lg-b li.pick-v[data-value="'+get_today('d')+'"]')
							.nextAll('li')
							.addClass('pick-lk')
						}
						else {
							if(get_current('m')>get_today('m')) {
								get_picker_els('.pick-lg .pick-lg-b li')
								.addClass('pick-lk')
							}
							else if(get_current('m')<get_today('m')&&get_current('y')>get_today('y')) {
								get_picker_els('.pick-lg .pick-lg-b li')
								.addClass('pick-lk')
							}
						}
					}
				}
			}
			if(pickers[picker.id].disabledays) {
				$.each(pickers[picker.id].disabledays, function( i, v ) {
					if(v&&is_date(v)) {
						var
							d = new Date(v*1000);
						if(d.getMonth()+1==get_current('m')&&d.getFullYear()==get_current('y'))
							get_picker_els('.pick-lg .pick-lg-b li.pick-v[data-value="'+d.getDate()+'"]')
							.addClass('pick-lk');
					}
				});
			}

			get_picker_els('.pick-lg-b li.pick-v[data-value='+get_current('d')+']').addClass('pick-sl');

		},
		picker_fills = function() {

			var
				m = get_current('m'),
				y = get_current('y'),
				l = ((y % 4) == 0 && ((y % 100) != 0 || (y % 400) == 0));

			pickers[picker.id].key['d'].max =  [31, (l ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m-1];

			if(get_current('d')>pickers[picker.id].key['d'].max) {
				pickers[picker.id].key['d'].current = pickers[picker.id].key['d'].max;
				picker_ul_transition('d',get_current('d'));
			}

			get_picker_els('.pick-d li')
			.removeClass('pick-wke')
			.each(function() {
				var
					d = new Date(m+"/"+$(this).attr('value')+"/"+y).getDay();

				$(this)
				.find('span')
				.html(i18n[pickers[picker.id].lang].weekdays.full[d]);

				if(d==0||d==6)
					$(this).addClass('pick-wke');

			});

			if(picker.element.hasClass('picker-lg')) {
				get_picker_els('.pick-lg-b li').removeClass('pick-wke');
				get_picker_els('.pick-lg-b li.pick-v')
				.each(function() {
					var
						d = new Date(m+"/"+$(this).attr('data-value')+"/"+y).getDay();
					if(d==0||d==6)
						$(this).addClass('pick-wke');

				});
			}

		},
		picker_set = function() {
			if(picker.element.hasClass('picker-lg'))
				picker_render_calendar();
			picker_fills();
			input_change_value();
		},

		// ACTION FUNCTIONS

		picker_ul_transition = function(k,i) {

			var
				ul = get_ul(k);

			ul.find('li').removeClass('pick-sl pick-bfr pick-afr');

			if(i==get_eq(k,'last')) {
				var li = ul.find('li[value="'+get_eq(k,'first')+'"]');
				li.clone().insertAfter(ul.find('li[value='+i+']'));
				li.remove();
			}
			if(i==get_eq(k,'first')) {
				var li = ul.find('li[value="'+get_eq(k,'last')+'"]');
				li.clone().insertBefore(ul.find('li[value='+i+']'));
				li.remove();
			}

			ul.find('li[value='+i+']').addClass('pick-sl');
			ul.find('li.pick-sl').nextAll('li').addClass('pick-afr');
			ul.find('li.pick-sl').prevAll('li').addClass('pick-bfr');

		},
		picker_values_increase = function(k,v) {

			var
				key_values = pickers[picker.id].key[k];

			if(v>key_values.max) {
				if(k=='d')
					picker_ul_turn('m','right');
				if(k=='m')
					picker_ul_turn('y','right');
				v = key_values.min;
			}
			if(v<key_values.min) {
				if(k=='d')
					picker_ul_turn('m','left');
				if(k=='m')
					picker_ul_turn('y','left');
				v = key_values.max;
			}
			pickers[picker.id].key[k].current = v;
			picker_ul_transition(k,v);

		},
		picker_ul_turn = function(k,d) {
			var
				v = get_current(k);
			if(d=='right')
				v++;
			else
				v--;
			picker_values_increase(k,v);
		},
		picker_alrt = function() {
			picker.element
			.addClass('picker-rmbl');
		},

		/* INPUT FUNCTIONS */

		input_fill = function(n) {
			return n < 10 ? '0' + n : n
		},
		input_ordinal_suffix = function(n) {
			var
				s=["th","st","nd","rd"],
				v=n%100;
			return n+(s[(v-20)%10]||s[v]||s[0]);
		},
		input_change_value = function() {

			if(!is_locked()&&picker_ctrl) {

				var
					d = get_current('d'),
					m = get_current('m'),
					y = get_current('y'),
					get_day = new Date(m+"/"+d+"/"+y).getDay(),

					str =
					pickers[picker.id].format
					.replace(/\b(d)\b/g, input_fill(d))
					.replace(/\b(m)\b/g, input_fill(m))
					.replace(/\b(S)\b/g, input_ordinal_suffix(d)) //new
					.replace(/\b(Y)\b/g, y)
					.replace(/\b(U)\b/g, get_unix(get_current_full())) //new
					.replace(/\b(D)\b/g, i18n[pickers[picker.id].lang].weekdays.short[get_day])
					.replace(/\b(l)\b/g, i18n[pickers[picker.id].lang].weekdays.full[get_day])
					.replace(/\b(F)\b/g, i18n[pickers[picker.id].lang].months.full[m-1])
					.replace(/\b(M)\b/g, i18n[pickers[picker.id].lang].months.short[m-1])
					.replace(/\b(n)\b/g, m)
					.replace(/\b(j)\b/g, d);

				picker
				.input
				.val(str)
				.change();

				picker_ctrl = false;

			}

		};

	// GET UI EVENT

	if(is_touch())
		var
			ui_event = {
				i : 'touchstart',
				m	: 'touchmove',
				e : 'touchend'
			}
	else
		var
			ui_event = {
				i : 'mousedown',
				m	: 'mousemove',
				e : 'mouseup'
			}


	var
		picker_node_el = 'div.datedropper.picker-focus';

	$(document)


	//CLOSE PICKER
	.on('click',function(e) {
		if(picker) {
			if(!picker.input.is(e.target) && !picker.element.is(e.target) && picker.element.has(e.target).length === 0) {
				picker_hide();
				pick_dragged = null;
			}
		}
	})

	//LOCK ANIMATION
	.on(csse.a,picker_node_el + '.picker-rmbl',function(){
		if(picker.element.hasClass('picker-rmbl'))
			$(this).removeClass('picker-rmbl');
	})

	//HIDE MODAL OVERLAY
	.on(csse.t,'.picker-modal-overlay',function(){
		$(this).remove();
	})


	//LARGE-MODE DAY CLICK
	.on(ui_event.i,picker_node_el+' .pick-lg li.pick-v',function(){
		get_picker_els('.pick-lg-b li').removeClass('pick-sl');
		$(this).addClass('pick-sl');
		pickers[picker.id].key['d'].current = $(this).attr('data-value');
		picker_ul_transition('d',$(this).attr('data-value'));
		picker_ctrl = true;
	})

	//BUTTON LARGE-MODE
	.on('click',picker_node_el+' .pick-btn-sz',function(){
		picker_large_onoff();
	})

	//BUTTON TRANSLATE-MODE
	.on('click',picker_node_el+' .pick-btn-lng',function(){
		picker_translate_onoff();
	})

	//JUMP
	.on(ui_event.i,picker_node_el+' .pick-arw.pick-arw-s2',function(e){

		e.preventDefault();
		pick_dragged = null;

		var
			i,
			k = $(this).closest('ul').data('k'),
			jump = pickers[picker.id].jump;

		if($(this).hasClass('pick-arw-r'))
			i = get_current('y') + jump;
		else
			i = get_current('y') - jump;

		var
			jumped_array = get_jumped('y',jump);

		if(i>jumped_array[jumped_array.length-1])
			i = jumped_array[0];
		if(i<jumped_array[0])
			i = jumped_array[jumped_array.length-1];

		pickers[picker.id].key['y'].current = i;
		picker_ul_transition('y',get_current('y'));

		picker_ctrl = true;

	})

	//DEFAULT ARROW
	.on(ui_event.i,picker_node_el+' .pick-arw.pick-arw-s1',function(e){
		e.preventDefault();
		pick_dragged = null;
		var
			k = $(this).closest('ul').data('k');
		if($(this).hasClass('pick-arw-r'))
			picker_ul_turn(k,'right');
		else
			picker_ul_turn(k,'left');

		picker_ctrl = true;

	})

	// JUMP
	.on(ui_event.i,picker_node_el+' ul.pick.pick-y li',function(){
		is_click = true;
	})
	.on(ui_event.e,picker_node_el+' ul.pick.pick-y li',function(){
		if(is_click&&is_jumpable()) {
			$(this).closest('ul').toggleClass('pick-jump');
			var
				jumped = get_closest_jumped(get_current('y'),get_jumped('y',pickers[picker.id].jump));
			pickers[picker.id].key['y'].current = jumped;
			picker_ul_transition('y',get_current('y'));
			is_click = false;
		}
	})

	//TOGGLE CALENDAR
	.on(ui_event.i,picker_node_el+' ul.pick.pick-d li',function(){
		is_click = true;
	})
	.on(ui_event.e,picker_node_el+' ul.pick.pick-d li',function(){
		if(is_click) {
			picker_large_onoff();
			is_click = false;
		}
	})

	//TOGGLE TRANSLATE MODE
	.on(ui_event.i,picker_node_el+' ul.pick.pick-l li',function(){
		is_click = true;
	})
	.on(ui_event.e,picker_node_el+' ul.pick.pick-l li',function(){
		if(is_click) {
			picker_translate_onoff();
			picker_translate($(this).val());
			is_click = false;
		}
	})

	//MOUSEDOWN ON UL
	.on(ui_event.i,picker_node_el+' ul.pick',function(e){
		pick_dragged = $(this);
		if(pick_dragged) {
			var
				k = pick_dragged.data('k');
			pick_drag_offset = is_touch() ? e.originalEvent.touches[0].pageY : e.pageY;
			pick_drag_temp = get_current(k);
		}
	})

	//MOUSEMOVE ON UL
	.on(ui_event.m,function(e){

		is_click = false;

		if(pick_dragged) {
			e.preventDefault();
			var
				k = pick_dragged.data('k');
				o = is_touch() ? e.originalEvent.touches[0].pageY : e.pageY;
			o = pick_drag_offset - o;
			o = Math.round(o * .026);
			i = pick_drag_temp + o;
			var
				int = get_clear(k,i);
			if(int!=pickers[picker.id].key[k].current)
				picker_values_increase(k,int);

			picker_ctrl = true;
		}
	})

	//MOUSEUP ON UL
	.on(ui_event.e,function(e){
		if( pick_dragged )
			pick_dragged = null,
			pick_drag_offset = null,
			pick_drag_temp = null;
		if(picker)
			picker_set();
	})

	//CLICK SUBMIT
	.on(ui_event.i,picker_node_el+' .pick-submit',function(){
		picker_hide();
	});

	$(window).resize(function(){
		if(picker) {
			picker_offset();
			is_fx_mobile();
		}
	});

	$.fn.dateDropper = function(options) {
		return $(this).each(function(){
			if($(this).is('input')&&!$(this).hasClass('picker-input')) {

				var
					input = $(this),
					id = 'datedropper-' + Object.keys(pickers).length;

				input
				.attr('data-id',id)
				.addClass('picker-input')
				.prop({
					'type':'text',
					'readonly' : true
				});

				var
					picker_default_date = (input.data('default-date')&&is_date(input.data('default-date'))) ? input.data('default-date') : null,
					picker_disabled_days = (input.data('disabled-days')) ? input.data('disabled-days').split(',') : null,
					picker_format = input.data('format') || 'm/d/Y',
					picker_fx = (input.data('fx')===false) ? input.data('fx') : true,
					picker_fx_class = (input.data('fx')===false) ? '' : 'picker-fxs',
					picker_fx_mobile = (input.data('fx-mobile')===false) ? input.data('fx-mobile') : true,
					picker_init_set = (input.data('init-set')===false) ? false : true,
					picker_lang = (input.data('lang')&&(input.data('lang') in i18n)) ? input.data('lang') : 'en',
					picker_large = (input.data('large-mode')===true) ? true : false,
					picker_large_class = (input.data('large-default')===true && picker_large===true) ? 'picker-lg' : '',
					picker_lock = (input.data('lock')=='from'||input.data('lock')=='to') ? input.data('lock') : false,
					picker_jump = (input.data('jump')&&is_int(input.data('jump'))) ? input.data('jump') : 10,
					picker_max_year = (input.data('max-year')&&is_int(input.data('max-year'))) ? input.data('max-year') : new Date().getFullYear(),
					picker_min_year = (input.data('min-year')&&is_int(input.data('min-year'))) ? input.data('min-year') : 1970,

					picker_modal = (input.data('modal')===true) ? 'picker-modal' : '',
					picker_theme = input.data('theme') || 'primary',
					picker_translate_mode = (input.data('translate-mode')===true) ? true : false;

				if(picker_disabled_days) {
					$.each(picker_disabled_days, function( index, value ) {
						if(value&&is_date(value))
							picker_disabled_days[index] = get_unix(value);
					});
				}

				pickers[id] = {
					disabledays : picker_disabled_days,
					format : picker_format,
					fx : picker_fx,
					fxmobile : picker_fx_mobile,
					lang : picker_lang,
					large : picker_large,
					lock : picker_lock,
					jump : picker_jump,
					key : {
						m : {
							min : 1,
							max : 12,
							current : 1,
							today : (new Date().getMonth()+1)
						},
						d : {
							min : 1,
							max : 31,
							current : 1,
							today : new Date().getDate()
						},
						y : {
							min : picker_min_year,
							max : picker_max_year,
							current : picker_min_year,
							today : new Date().getFullYear()
						},
						l : {
							min : 0,
							max : Object.keys(i18n).length-1,
							current : 0,
							today : 0
						}
					},
					translate : picker_translate_mode
				};

				if(picker_default_date) {

					var regex = /\d+/g;
					var string = picker_default_date;
					var matches = string.match(regex);

					$.each(matches, function( index, value ) {
						matches[index] = parseInt(value);
					});

					pickers[id].key.m.today = (matches[0]&&matches[0]<=12) ? matches[0] : pickers[id].key.m.today;
					pickers[id].key.d.today = (matches[1]&&matches[1]<=31) ? matches[1] : pickers[id].key.d.today;
					pickers[id].key.y.today = (matches[2]) ? matches[2] : pickers[id].key.y.today;

					if(pickers[id].key.y.today>pickers[id].key.y.max)
						pickers[id].key.y.max = pickers[id].key.y.today;
					if(pickers[id].key.y.today<pickers[id].key.y.min)
						pickers[id].key.y.min = pickers[id].key.y.today;

				}

				$('<div>', {
					class: 'datedropper ' + picker_modal + ' ' + picker_theme + ' ' + picker_fx_class + ' ' + picker_large_class,
					id: id,
					html: $('<div>', {
						class: 'picker'
					})
				})
				.appendTo('body');

				picker = {
					id : id,
					input : input,
					element : $('#' + id)
				};

				for( var k in pickers[id].key ) {
					$('<ul>', {
						class: 'pick pick-' + k,
						'data-k' : k
					})
					.appendTo(get_picker_els('.picker'));
					picker_render_ul(k);
				}

				if(pickers[id].large) {

					//calendar
					$('<div>', {
						class: 'pick-lg'
					})
					.insertBefore(get_picker_els('.pick-d'));

					$('<ul class="pick-lg-h"></ul><ul class="pick-lg-b"></ul>')
					.appendTo(get_picker_els('.pick-lg'));

					var
						picker_day_offset = get_days_array();

					for(var i = 0; i < 7 ; i++) {
						$('<li>', {
							html: i18n[pickers[picker.id].lang].weekdays.short[picker_day_offset[i]]
						})
						.appendTo(get_picker_els('.pick-lg .pick-lg-h'))
					}
					for(var i = 0; i < 42 ; i++) {
						$('<li>')
						.appendTo(get_picker_els('.pick-lg .pick-lg-b'))
					}
				}

				//buttons
				$('<div>', {
					class: 'pick-btns'
				})
				.appendTo(get_picker_els('.picker'));

				$('<div>', {
					class: 'pick-submit'
				})
				.appendTo(get_picker_els('.pick-btns'));

				if(pickers[picker.id].translate) {
					$('<div>', {
						class: 'pick-btn pick-btn-lng'
					})
					.appendTo(get_picker_els('.pick-btns'));
				}
				if(pickers[picker.id].large) {
					$('<div>', {
						class: 'pick-btn pick-btn-sz'
					})
					.appendTo(get_picker_els('.pick-btns'));
				}

				if(picker_format=='Y'||picker_format=='m') {
					get_picker_els('.pick-d,.pick-btn-sz').hide();
					picker.element.addClass('picker-tiny');
					if(picker_format=='Y')
						get_picker_els('.pick-m,.pick-btn-lng').hide();
					if(picker_format=='m')
						get_picker_els('.pick-y').hide();
				}

				if(picker_init_set) {
					picker_ctrl = true;
					input_change_value();
				}

				picker = null;

			}

		})
		.focus(function(e){

			e.preventDefault();
			$(this).blur();

			if(picker)
				picker_hide();

			picker = {
				id : $(this).data('id'),
				input : $(this),
				element : $('#'+$(this).data('id'))
			};

			is_fx_mobile();
			picker_offset();
			picker_set();
			picker_show();

			if(picker.element.hasClass('picker-modal'))
				$('body').append('<div class="picker-modal-overlay"></div>')

		});
	};
}(jQuery));

/**
	 * Time Dropper
*/
(function($) {
    $.fn.timeDropper = function(options, callbackFnk) {
        return $(this).each(function() {

            var
                _td_input = $(this),
                _td_input_on = false,
                _td_mobile = false,
                _td_num = function(n) {
                    return n < 10 ? '0' + n : n
                },
                _td_id = $('.td-clock').length,
                _td_alert,
                _td_event = null,
                _td_options = $.extend({

                    format: 'h:mm a',
                    autoswitch: false,
                    meridians: false,
                    mousewheel: false,
                    setCurrentTime: true,
                    init_animation: "fadein",
                    primaryColor: "#1977CC",
                    borderColor: "#1977CC",
                    backgroundColor: "#FFF",
                    textColor: '#555'

                }, options);

            var _td_color = function(col, amt) {

                var usePound = false;

                if (col[0] == "#") {
                    col = col.slice(1);
                    usePound = true;
                }

                var num = parseInt(col, 16);

                var r = (num >> 16) + amt;

                if (r > 255) r = 255;
                else if (r < 0) r = 0;

                var b = ((num >> 8) & 0x00FF) + amt;

                if (b > 255) b = 255;
                else if (b < 0) b = 0;

                var g = (num & 0x0000FF) + amt;

                if (g > 255) g = 255;
                else if (g < 0) g = 0;

                return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);

            };

            _td_input.prop({
                'readonly': true
            }).addClass('td-input');

            $('body').append('<div class="td-wrap td-n2" id="td-clock-' + _td_id + '"><div class="td-overlay"></div><div class="td-clock td-init"><div class="td-deg td-n"><div class="td-select"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 35.4" enable-background="new 0 0 100 35.4" xml:space="preserve"><g><path fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" d="M98.1,33C85.4,21.5,68.5,14.5,50,14.5S14.6,21.5,1.9,33"/><line fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" x1="1.9" y1="33" x2="1.9" y2="28.6"/><line fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" x1="1.9" y1="33" x2="6.3" y2="33"/><line fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" x1="98.1" y1="33" x2="93.7" y2="33"/><line fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" x1="98.1" y1="33" x2="98.1" y2="28.6"/></g></svg></div></div><div class="td-medirian"><span class="td-icon-am td-n">AM</span><span class="td-icon-pm td-n">PM</span></div><div class="td-lancette"><div></div><div></div></div><div class="td-time"><span class="on"></span>:<span></span></div></div></div>');

            $('head').append('<style>#td-clock-' + _td_id + ' .td-clock {color:' + _td_options.textColor + ';background: ' + _td_options.backgroundColor + '; box-shadow: 0 0 0 1px ' + _td_options.borderColor + ',0 0 0 8px rgba(0, 0, 0, 0.05); } #td-clock-' + _td_id + ' .td-clock .td-time span.on { color:' + _td_options.primaryColor + '} #td-clock-' + _td_id + ' .td-clock:before { border-color: ' + _td_options.borderColor + '} #td-clock-' + _td_id + ' .td-select:after { box-shadow: 0 0 0 1px ' + _td_options.borderColor + ' } #td-clock-' + _td_id + ' .td-clock:before,#td-clock-' + _td_id + ' .td-select:after {background: ' + _td_options.backgroundColor + ';} #td-clock-' + _td_id + ' .td-lancette {border: 2px solid ' + _td_options.primaryColor + '; opacity:0.1}#td-clock-' + _td_id + ' .td-lancette div:after { background: ' + _td_options.primaryColor + ';} #td-clock-' + _td_id + ' .td-bulletpoint div:after { background:' + _td_options.primaryColor + '; opacity:0.1}</style>');



            var
                _td_container = $('#td-clock-' + _td_id),
                _td_overlay = _td_container.find('.td-overlay'),
                _td_c = _td_container.find('.td-clock');


            _td_c.find('svg').attr('style', "stroke:" + _td_options.borderColor);


            var
                _td_init_deg = -1,
                _td_event_deg = 0,
                _td_wheel_deg = 0,
                _td_h,
                _td_m,
                _td_define_deg = function() {

                    var
                        o = _td_c.find('.td-time span.on'),
                        v = parseInt(o.attr('data-id'));

                    if (o.index() == 0) deg = Math.round((v * 360 / 23));
                    else deg = Math.round((v * 360 / 59));

                    _td_init_deg = -1;
                    _td_event_deg = deg;
                    _td_wheel_deg = deg;

                },
                _td_rotation = function(deg) {

                    var t = _td_c.find('.td-time span.on');

                    var value = t.attr('data-id');

                    if (!value) value = 0;

                    var h = Math.round((deg * 23 / 360));
                    var m = Math.round((deg * 59 / 360));

                    if (t.index() == 0) {

                        t.attr('data-id', _td_num(h));

                        if (_td_options.meridians) {

                            if (h >= 12 && h < 24) {
                                _td_c.find('.td-icon-pm').addClass('td-on');
                                _td_c.find('.td-icon-am').removeClass('td-on');
                            } else {

                                _td_c.find('.td-icon-am').addClass('td-on');
                                _td_c.find('.td-icon-pm').removeClass('td-on');
                            }

                            if (h > 12) h = h - 12;
                            if (h == 0) h = 12;

                        }

                        t.text(_td_num(h));

                    } else {
                        t.attr('data-id', _td_num(m)).text(_td_num(m));
                    }

                    _td_wheel_deg = deg;
                    _td_c.find('.td-deg').css('transform', 'rotate(' + (deg) + 'deg)');

                    if (t.index() == 0) {
                        var c = Math.round((h * 360 / 12));
                        _td_c.find('.td-lancette div:last').css('transform', 'rotate(' + (c) + 'deg)');
                    } else {
                        _td_c.find('.td-lancette div:first').css('transform', 'rotate(' + (deg) + 'deg)');
                    }

                    var
                        _td_h = _td_c.find('.td-time span:first').attr('data-id'),
                        _td_m = _td_c.find('.td-time span:last').attr('data-id');

                    if (Math.round(_td_h) >= 12 && Math.round(_td_h) < 24) {
                        var
                            h = Math.round(_td_h) - 12,
                            a = 'pm',
                            A = 'PM';
                    } else {
                        var
                            h = Math.round(_td_h),
                            a = 'am',
                            A = 'AM';
                    }

                    if (h == 0) h = 12;

                    var
                        str =
                        _td_options.format
                        .replace(/\b(H)\b/g, Math.round(_td_h))
                        .replace(/\b(h)\b/g, Math.round(h))
                        .replace(/\b(m)\b/g, Math.round(_td_m))
                        .replace(/\b(HH)\b/g, _td_num(Math.round(_td_h)))
                        .replace(/\b(hh)\b/g, _td_num(Math.round(h)))
                        .replace(/\b(mm)\b/g, _td_num(Math.round(_td_m)))
                        .replace(/\b(a)\b/g, a)
                        .replace(/\b(A)\b/g, A);

                    _td_input.val(str);


                };


            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                _td_mobile = true;
            }

            _td_c.find('.td-time span').on('click', function(e) {

                var o = $(this);

                _td_c.find('.td-time span').removeClass('on');
                o.addClass('on');

                var v = parseInt(o.attr('data-id'));

                if (o.index() == 0) deg = Math.round((v * 360 / 23));
                else deg = Math.round((v * 360 / 59));

                _td_init_deg = -1;
                _td_event_deg = deg;
                _td_wheel_deg = deg;
                _td_rotation(deg);

            });

            _td_c.find('.td-deg').on('touchstart mousedown', function(e) {

                _td_define_deg();

                e.preventDefault();

                clearInterval(_td_alert);

                _td_c.find('.td-deg').removeClass('td-n');
                _td_c.find('.td-select').removeClass('td-rubber');

                _td_input_on = true;

                var offset = _td_c.offset();
                var center = {
                    y: offset.top + _td_c.height() / 2,
                    x: offset.left + _td_c.width() / 2
                };

                var a, b, deg, tmp, rad2deg = 180 / Math.PI;

                _td_c.removeClass('td-rubber');

                $(window).on('touchmove mousemove', function(e) {

                    if (_td_input_on == true) {

                        if (_td_mobile) move = e.originalEvent.touches[0];
                        else move = e;

                        a = center.y - move.pageY;
                        b = center.x - move.pageX;
                        deg = Math.atan2(a, b) * rad2deg;

                        if (deg < 0)
                            deg = 360 + deg;

                        if (_td_init_deg == -1)
                            _td_init_deg = deg;

                        tmp = Math.floor((deg - _td_init_deg) + _td_event_deg);

                        if (tmp < 0) tmp = 360 + tmp;
                        else if (tmp > 360) tmp = tmp % 360;

                        _td_rotation(tmp);

                    }

                });

            });

            if (_td_options.mousewheel) {

                _td_c.on('mousewheel', function(e) {

                    e.preventDefault();

                    _td_c.find('.td-deg').removeClass('td-n');

                    if (e.originalEvent.wheelDelta > 0) {
                        if (_td_wheel_deg <= 360) {
                            if (e.originalEvent.wheelDelta <= 120) _td_wheel_deg++
                                else if (e.originalEvent.wheelDelta > 120) _td_wheel_deg = _td_wheel_deg + 20;
                            if (_td_wheel_deg > 360) _td_wheel_deg = 0;
                        }
                    } else {
                        if (_td_wheel_deg >= 0) {
                            if (e.originalEvent.wheelDelta >= -120) _td_wheel_deg--
                                else if (e.originalEvent.wheelDelta < -120) _td_wheel_deg = _td_wheel_deg - 20;
                            if (_td_wheel_deg < 0) _td_wheel_deg = 360;
                        }
                    }

                    _td_init_deg = -1;
                    _td_event_deg = _td_wheel_deg;
                    _td_rotation(_td_wheel_deg);

                });

            }

            $(document).on('touchend mouseup', function() {

                if (_td_input_on) {

                    _td_input_on = false;

                    if (_td_options.autoswitch) {
                        _td_c.find('.td-time span').toggleClass('on');
                        _td_c.find('.td-time span.on').click();
                    }

                    _td_c.find('.td-deg').addClass('td-n');
                    _td_c.find('.td-select').addClass('td-rubber');

                }

            });

            var _td_init = function(value) {

                var
                    d = new Date(),
                    _td_span_h = _td_c.find('.td-time span:first'),
                    _td_span_m = _td_c.find('.td-time span:last'),
                    h,
                    m;

                if (_td_input.val().length && !_td_options.setCurrentTime) {

                    var reg = /\d+/g,
                        am;
                    var st = _td_input.val().split(':');

                    if (st) {

                        h = st[0].match(reg);
                        m = st[1].match(reg);
                        if (_td_input.val().indexOf("am") != -1 || _td_input.val().indexOf("AM") != -1 || _td_input.val().indexOf("pm") != -1 || _td_input.val().indexOf("PM") != -1) {
                            if (_td_input.val().indexOf("am") != -1 || _td_input.val().indexOf("AM") != -1) am = true;
                            else am = false;

                            if (!am) {
                                if (h < 13) {
                                    h = parseInt(h) + 12;
                                    if (h == 24) h = 0;
                                }
                            } else if (h == 12) h = 0;
                        } else if (h == 24) h = 0;
                    } else {

                        if (!parseInt(_td_span_h.text())) h = _td_num(d.getHours());
                        else h = _td_num(_td_span_h.text());
                        if (!parseInt(_td_span_m.text())) m = _td_num(d.getMinutes());
                        else m = _td_num(_td_span_m.text());

                    }

                } else {

                    if (!parseInt(_td_span_h.text())) h = _td_num(d.getHours());
                    else h = _td_num(_td_span_h.text());
                    if (!parseInt(_td_span_m.text())) m = _td_num(d.getMinutes());
                    else m = _td_num(_td_span_m.text());

                }

                _td_span_h.attr('data-id', h).text(h);
                _td_span_m.attr('data-id', m).text(m);

                _td_event_deg = Math.round((h * 360 / 23));

                _td_c.find('.td-lancette div:first').css('transform', 'rotate(' + Math.round((m * 360 / 59)) + 'deg)');

                _td_rotation(_td_event_deg);
                _td_wheel_deg = _td_event_deg;
                _td_init_deg = -1;


            }

            _td_init();

            _td_input.focus(function(e) {
                e.preventDefault();
                _td_input.blur();
            });

            _td_input.click(function(e) {

                clearInterval(_td_event);

                _td_container.removeClass('td-fadeout');
                _td_container.addClass('td-show').addClass('td-' + _td_options.init_animation);
                _td_c.css({
                    'top': (_td_input.offset().top + (_td_input.outerHeight() - 8)),
                    'left': (_td_input.offset().left + (_td_input.outerWidth() / 2)) - (_td_c.outerWidth() / 2)
                });

                if (_td_c.hasClass('td-init')) {

                    _td_alert = setInterval(function() {
                        _td_c.find('.td-select').addClass('td-alert');
                        setTimeout(function() {
                            _td_c.find('.td-select').removeClass('td-alert');
                        }, 1000);
                    }, 2000);

                    _td_c.removeClass('td-init');

                }

            });
            _td_overlay.click(function() {

                _td_container.addClass('td-fadeout').removeClass('td-' + _td_options.init_animation);
                _td_event = setTimeout(function() {
                    _td_container.removeClass('td-show')
                }, 300);

            });
            $(window).on('resize', function() {

                _td_define_deg();
                _td_c.css({
                    'top': (_td_input.offset().top + (_td_input.outerHeight() - 8)),
                    'left': (_td_input.offset().left + (_td_input.outerWidth() / 2)) - (_td_c.outerWidth() / 2)
                });
            });

        });
    };
}(jQuery));

/*
 * jQuery mmenu v6.1.8
 * @requires jQuery 1.7.0 or later
 *
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * License: CC-BY-NC-4.0
 * http://creativecommons.org/licenses/by-nc/4.0/
 */

;
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('jquery'));
    } else {
        root.jquery_mmenu_all_js = factory(root.jQuery);
    }
}(this, function(jQuery) {

    ! function(e) {
        function t() {
            e[n].glbl || (r = {
                $wndw: e(window),
                $docu: e(document),
                $html: e("html"),
                $body: e("body")
            }, s = {}, a = {}, o = {}, e.each([s, a, o], function(e, t) {
                t.add = function(e) {
                    e = e.split(" ");
                    for (var n = 0, i = e.length; n < i; n++) t[e[n]] = t.mm(e[n])
                }
            }), s.mm = function(e) {
                return "mm-" + e
            }, s.add("wrapper menu panels panel nopanel highest opened subopened navbar hasnavbar title btn prev next listview nolistview inset vertical selected divider spacer hidden fullsubopen noanimation"), s.umm = function(e) {
                return "mm-" == e.slice(0, 3) && (e = e.slice(3)), e
            }, a.mm = function(e) {
                return "mm-" + e
            }, a.add("parent child"), o.mm = function(e) {
                return e + ".mm"
            }, o.add("transitionend webkitTransitionEnd click scroll resize keydown mousedown mouseup touchstart touchmove touchend orientationchange"), e[n]._c = s, e[n]._d = a, e[n]._e = o, e[n].glbl = r)
        }
        var n = "mmenu",
            i = "6.1.8";
        if (!(e[n] && e[n].version > i)) {
            e[n] = function(e, t, n) {
                return this.$menu = e, this._api = ["bind", "getInstance", "initPanels", "openPanel", "closePanel", "closeAllPanels", "setSelected"], this.opts = t, this.conf = n, this.vars = {}, this.cbck = {}, this.mtch = {}, "function" == typeof this.___deprecated && this.___deprecated(), this._initAddons(), this._initExtensions(), this._initMenu(), this._initPanels(), this._initOpened(), this._initAnchors(), this._initMatchMedia(), "function" == typeof this.___debug && this.___debug(), this
            }, e[n].version = i, e[n].addons = {}, e[n].uniqueId = 0, e[n].defaults = {
                extensions: [],
                initMenu: function() {},
                initPanels: function() {},
                navbar: {
                    add: !0,
                    title: "Menu",
                    titleLink: "parent"
                },
                onClick: {
                    setSelected: !0
                },
                slidingSubmenus: !0
            }, e[n].configuration = {
                classNames: {
                    divider: "Divider",
                    inset: "Inset",
                    nolistview: "NoListview",
                    nopanel: "NoPanel",
                    panel: "Panel",
                    selected: "Selected",
                    spacer: "Spacer",
                    vertical: "Vertical"
                },
                clone: !1,
                openingInterval: 25,
                panelNodetype: "ul, ol, div",
                transitionDuration: 400
            }, e[n].prototype = {
                getInstance: function() {
                    return this
                },
                initPanels: function(e) {
                    this._initPanels(e)
                },
                openPanel: function(t, i) {
                    if (this.trigger("openPanel:before", t), t && t.length && (t.is("." + s.panel) || (t = t.closest("." + s.panel)), t.is("." + s.panel))) {
                        var o = this;
                        if ("boolean" != typeof i && (i = !0), t.hasClass(s.vertical)) t.add(t.parents("." + s.vertical)).removeClass(s.hidden).parent("li").addClass(s.opened), this.openPanel(t.parents("." + s.panel).not("." + s.vertical).first()), this.trigger("openPanel:start", t), this.trigger("openPanel:finish", t);
                        else {
                            if (t.hasClass(s.opened)) return;
                            var r = this.$pnls.children("." + s.panel),
                                l = r.filter("." + s.opened);
                            if (!e[n].support.csstransitions) return l.addClass(s.hidden).removeClass(s.opened), t.removeClass(s.hidden).addClass(s.opened), this.trigger("openPanel:start", t), void this.trigger("openPanel:finish", t);
                            r.not(t).removeClass(s.subopened);
                            for (var d = t.data(a.parent); d;) d = d.closest("." + s.panel), d.is("." + s.vertical) || d.addClass(s.subopened), d = d.data(a.parent);
                            r.removeClass(s.highest).not(l).not(t).addClass(s.hidden), t.removeClass(s.hidden), this.openPanelStart = function() {
                                l.removeClass(s.opened), t.addClass(s.opened), t.hasClass(s.subopened) ? (l.addClass(s.highest), t.removeClass(s.subopened)) : (l.addClass(s.subopened), t.addClass(s.highest)), this.trigger("openPanel:start", t)
                            }, this.openPanelFinish = function() {
                                l.removeClass(s.highest).addClass(s.hidden), t.removeClass(s.highest), this.trigger("openPanel:finish", t)
                            }, i && !t.hasClass(s.noanimation) ? setTimeout(function() {
                                o.__transitionend(t, function() {
                                    o.openPanelFinish.call(o)
                                }, o.conf.transitionDuration), o.openPanelStart.call(o)
                            }, o.conf.openingInterval) : (this.openPanelStart.call(this), this.openPanelFinish.call(this))
                        }
                        this.trigger("openPanel:after", t)
                    }
                },
                closePanel: function(e) {
                    this.trigger("closePanel:before", e);
                    var t = e.parent();
                    t.hasClass(s.vertical) && (t.removeClass(s.opened), this.trigger("closePanel", e)), this.trigger("closePanel:after", e)
                },
                closeAllPanels: function(e) {
                    this.trigger("closeAllPanels:before"), this.$pnls.find("." + s.listview).children().removeClass(s.selected).filter("." + s.vertical).removeClass(s.opened);
                    var t = this.$pnls.children("." + s.panel),
                        n = e && e.length ? e : t.first();
                    this.$pnls.children("." + s.panel).not(n).removeClass(s.subopened).removeClass(s.opened).removeClass(s.highest).addClass(s.hidden), this.openPanel(n, !1), this.trigger("closeAllPanels:after")
                },
                togglePanel: function(e) {
                    var t = e.parent();
                    t.hasClass(s.vertical) && this[t.hasClass(s.opened) ? "closePanel" : "openPanel"](e)
                },
                setSelected: function(e) {
                    this.trigger("setSelected:before", e), this.$menu.find("." + s.listview).children("." + s.selected).removeClass(s.selected), e.addClass(s.selected), this.trigger("setSelected:after", e)
                },
                bind: function(e, t) {
                    this.cbck[e] = this.cbck[e] || [], this.cbck[e].push(t)
                },
                trigger: function() {
                    var e = this,
                        t = Array.prototype.slice.call(arguments),
                        n = t.shift();
                    if (this.cbck[n])
                        for (var i = 0, s = this.cbck[n].length; i < s; i++) this.cbck[n][i].apply(e, t)
                },
                matchMedia: function(e, t, n) {
                    var i = {
                        yes: t,
                        no: n
                    };
                    this.mtch[e] = this.mtch[e] || [], this.mtch[e].push(i)
                },
                _initAddons: function() {
                    this.trigger("initAddons:before");
                    var t;
                    for (t in e[n].addons) e[n].addons[t].add.call(this), e[n].addons[t].add = function() {};
                    for (t in e[n].addons) e[n].addons[t].setup.call(this);
                    this.trigger("initAddons:after")
                },
                _initExtensions: function() {
                    this.trigger("initExtensions:before");
                    var e = this;
                    this.opts.extensions.constructor === Array && (this.opts.extensions = {
                        all: this.opts.extensions
                    });
                    for (var t in this.opts.extensions) this.opts.extensions[t] = this.opts.extensions[t].length ? "mm-" + this.opts.extensions[t].join(" mm-") : "", this.opts.extensions[t] && ! function(t) {
                        e.matchMedia(t, function() {
                            this.$menu.addClass(this.opts.extensions[t])
                        }, function() {
                            this.$menu.removeClass(this.opts.extensions[t])
                        })
                    }(t);
                    this.trigger("initExtensions:after")
                },
                _initMenu: function() {
                    this.trigger("initMenu:before");
                    this.conf.clone && (this.$orig = this.$menu, this.$menu = this.$orig.clone(), this.$menu.add(this.$menu.find("[id]")).filter("[id]").each(function() {
                        e(this).attr("id", s.mm(e(this).attr("id")))
                    })), this.opts.initMenu.call(this, this.$menu, this.$orig), this.$menu.attr("id", this.$menu.attr("id") || this.__getUniqueId()), this.$pnls = e('<div class="' + s.panels + '" />').append(this.$menu.children(this.conf.panelNodetype)).prependTo(this.$menu);
                    var t = [s.menu];
                    this.opts.slidingSubmenus || t.push(s.vertical), this.$menu.addClass(t.join(" ")).parent().addClass(s.wrapper), this.trigger("initMenu:after")
                },
                _initPanels: function(t) {
                    this.trigger("initPanels:before", t), t = t || this.$pnls.children(this.conf.panelNodetype);
                    var n = e(),
                        i = this,
                        a = function(t) {
                            t.filter(this.conf.panelNodetype).each(function() {
                                var t = i._initPanel(e(this));
                                if (t) {
                                    i._initNavbar(t), i._initListview(t), n = n.add(t);
                                    var o = t.children("." + s.listview).children("li").children(i.conf.panelNodeType).add(t.children("." + i.conf.classNames.panel));
                                    o.length && a.call(i, o)
                                }
                            })
                        };
                    a.call(this, t), this.opts.initPanels.call(this, n), this.trigger("initPanels:after", n)
                },
                _initPanel: function(e) {
                    this.trigger("initPanel:before", e);
                    if (e.hasClass(s.panel)) return e;
                    if (this.__refactorClass(e, this.conf.classNames.panel, "panel"), this.__refactorClass(e, this.conf.classNames.nopanel, "nopanel"), this.__refactorClass(e, this.conf.classNames.vertical, "vertical"), this.__refactorClass(e, this.conf.classNames.inset, "inset"), e.filter("." + s.inset).addClass(s.nopanel), e.hasClass(s.nopanel)) return !1;
                    var t = e.hasClass(s.vertical) || !this.opts.slidingSubmenus;
                    e.removeClass(s.vertical);
                    var n = e.attr("id") || this.__getUniqueId();
                    e.removeAttr("id"), e.is("ul, ol") && (e.wrap("<div />"), e = e.parent()), e.addClass(s.panel + " " + s.hidden).attr("id", n);
                    var i = e.parent("li");
                    return t ? e.add(i).addClass(s.vertical) : e.appendTo(this.$pnls), i.length && (i.data(a.child, e), e.data(a.parent, i)), this.trigger("initPanel:after", e), e
                },
                _initNavbar: function(t) {
                    if (this.trigger("initNavbar:before", t), !t.children("." + s.navbar).length) {
                        var i = t.data(a.parent),
                            o = e('<div class="' + s.navbar + '" />'),
                            r = e[n].i18n(this.opts.navbar.title),
                            l = "";
                        if (i && i.length) {
                            if (i.hasClass(s.vertical)) return;
                            if (i.parent().is("." + s.listview)) var d = i.children("a, span").not("." + s.next);
                            else var d = i.closest("." + s.panel).find('a[href="#' + t.attr("id") + '"]');
                            d = d.first(), i = d.closest("." + s.panel);
                            var c = i.attr("id");
                            switch (r = d.text(), this.opts.navbar.titleLink) {
                                case "anchor":
                                    l = d.attr("href");
                                    break;
                                case "parent":
                                    l = "#" + c
                            }
                            o.append('<a class="' + s.btn + " " + s.prev + '" href="#' + c + '" />')
                        } else if (!this.opts.navbar.title) return;
                        this.opts.navbar.add && t.addClass(s.hasnavbar), o.append('<a class="' + s.title + '"' + (l.length ? ' href="' + l + '"' : "") + ">" + r + "</a>").prependTo(t), this.trigger("initNavbar:after", t)
                    }
                },
                _initListview: function(t) {
                    this.trigger("initListview:before", t);
                    var n = this.__childAddBack(t, "ul, ol");
                    this.__refactorClass(n, this.conf.classNames.nolistview, "nolistview"), n.filter("." + this.conf.classNames.inset).addClass(s.nolistview);
                    var i = n.not("." + s.nolistview).addClass(s.listview).children();
                    this.__refactorClass(i, this.conf.classNames.selected, "selected"), this.__refactorClass(i, this.conf.classNames.divider, "divider"), this.__refactorClass(i, this.conf.classNames.spacer, "spacer");
                    var o = t.data(a.parent);
                    if (o && o.parent().is("." + s.listview) && !o.children("." + s.next).length) {
                        var r = o.children("a, span").first(),
                            l = e('<a class="' + s.next + '" href="#' + t.attr("id") + '" />').insertBefore(r);
                        r.is("span") && l.addClass(s.fullsubopen)
                    }
                    this.trigger("initListview:after", t)
                },
                _initOpened: function() {
                    this.trigger("initOpened:before");
                    var e = this.$pnls.find("." + s.listview).children("." + s.selected).removeClass(s.selected).last().addClass(s.selected),
                        t = e.length ? e.closest("." + s.panel) : this.$pnls.children("." + s.panel).first();
                    this.openPanel(t, !1), this.trigger("initOpened:after")
                },
                _initAnchors: function() {
                    var t = this;
                    r.$body.on(o.click + "-oncanvas", "a[href]", function(i) {
                        var a = e(this),
                            o = !1,
                            r = t.$menu.find(a).length;
                        for (var l in e[n].addons)
                            if (e[n].addons[l].clickAnchor.call(t, a, r)) {
                                o = !0;
                                break
                            }
                        var d = a.attr("href");
                        if (!o && r && d.length > 1 && "#" == d.slice(0, 1)) try {
                            var c = e(d, t.$menu);
                            c.is("." + s.panel) && (o = !0, t[a.parent().hasClass(s.vertical) ? "togglePanel" : "openPanel"](c))
                        } catch (h) {}
                        if (o && i.preventDefault(), !o && r && a.is("." + s.listview + " > li > a") && !a.is('[rel="external"]') && !a.is('[target="_blank"]')) {
                            t.__valueOrFn(t.opts.onClick.setSelected, a) && t.setSelected(e(i.target).parent());
                            var f = t.__valueOrFn(t.opts.onClick.preventDefault, a, "#" == d.slice(0, 1));
                            f && i.preventDefault(), t.__valueOrFn(t.opts.onClick.close, a, f) && t.opts.offCanvas && "function" == typeof t.close && t.close()
                        }
                    })
                },
                _initMatchMedia: function() {
                    var e = this;
                    this._fireMatchMedia(), r.$wndw.on(o.resize, function(t) {
                        e._fireMatchMedia()
                    })
                },
                _fireMatchMedia: function() {
                    for (var e in this.mtch)
                        for (var t = window.matchMedia && window.matchMedia(e).matches ? "yes" : "no", n = 0; n < this.mtch[e].length; n++) this.mtch[e][n][t].call(this)
                },
                _getOriginalMenuId: function() {
                    var e = this.$menu.attr("id");
                    return this.conf.clone && e && e.length && (e = s.umm(e)), e
                },
                __api: function() {
                    var t = this,
                        n = {};
                    return e.each(this._api, function(e) {
                        var i = this;
                        n[i] = function() {
                            var e = t[i].apply(t, arguments);
                            return "undefined" == typeof e ? n : e
                        }
                    }), n
                },
                __valueOrFn: function(e, t, n) {
                    return "function" == typeof e ? e.call(t[0]) : "undefined" == typeof e && "undefined" != typeof n ? n : e
                },
                __refactorClass: function(e, t, n) {
                    return e.filter("." + t).removeClass(t).addClass(s[n])
                },
                __findAddBack: function(e, t) {
                    return e.find(t).add(e.filter(t))
                },
                __childAddBack: function(e, t) {
                    return e.children(t).add(e.filter(t))
                },
                __filterListItems: function(e) {
                    return e.not("." + s.divider).not("." + s.hidden)
                },
                __filterListItemAnchors: function(e) {
                    return this.__filterListItems(e).children("a").not("." + s.next)
                },
                __transitionend: function(e, t, n) {
                    var i = !1,
                        s = function(n) {
                            "undefined" != typeof n && n.target != e[0] || (i || (e.off(o.transitionend), e.off(o.webkitTransitionEnd), t.call(e[0])), i = !0)
                        };
                    e.on(o.transitionend, s), e.on(o.webkitTransitionEnd, s), setTimeout(s, 1.1 * n)
                },
                __getUniqueId: function() {
                    return s.mm(e[n].uniqueId++)
                }
            }, e.fn[n] = function(i, s) {
                t(), i = e.extend(!0, {}, e[n].defaults, i), s = e.extend(!0, {}, e[n].configuration, s);
                var a = e();
                return this.each(function() {
                    var t = e(this);
                    if (!t.data(n)) {
                        var o = new e[n](t, i, s);
                        o.$menu.data(n, o.__api()), a = a.add(o.$menu)
                    }
                }), a
            }, e[n].i18n = function() {
                var t = {};
                return function(n) {
                    switch (typeof n) {
                        case "object":
                            return e.extend(t, n), t;
                        case "string":
                            return t[n] || n;
                        case "undefined":
                        default:
                            return t
                    }
                }
            }(), e[n].support = {
                touch: "ontouchstart" in window || navigator.msMaxTouchPoints || !1,
                csstransitions: function() {
                    return "undefined" == typeof Modernizr || "undefined" == typeof Modernizr.csstransitions || Modernizr.csstransitions
                }(),
                csstransforms: function() {
                    return "undefined" == typeof Modernizr || "undefined" == typeof Modernizr.csstransforms || Modernizr.csstransforms
                }(),
                csstransforms3d: function() {
                    return "undefined" == typeof Modernizr || "undefined" == typeof Modernizr.csstransforms3d || Modernizr.csstransforms3d
                }()
            };
            var s, a, o, r
        }
    }(jQuery),
    /*
     * jQuery mmenu offCanvas add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "offCanvas";
        e[t].addons[n] = {
            setup: function() {
                if (this.opts[n]) {
                    var s = this,
                        a = this.opts[n],
                        r = this.conf[n];
                    o = e[t].glbl, this._api = e.merge(this._api, ["open", "close", "setPage"]), "object" != typeof a && (a = {}), "top" != a.position && "bottom" != a.position || (a.zposition = "front"), a = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], a), "string" != typeof r.pageSelector && (r.pageSelector = "> " + r.pageNodetype), this.vars.opened = !1;
                    var l = [i.offcanvas];
                    "left" != a.position && l.push(i.mm(a.position)), "back" != a.zposition && l.push(i.mm(a.zposition)), e[t].support.csstransforms || l.push(i["no-csstransforms"]), e[t].support.csstransforms3d || l.push(i["no-csstransforms3d"]), this.bind("initMenu:after", function() {
                        var e = this;
                        this.setPage(o.$page), this._initBlocker(), this["_initWindow_" + n](), this.$menu.addClass(l.join(" ")).parent("." + i.wrapper).removeClass(i.wrapper), this.$menu[r.menuInsertMethod](r.menuInsertSelector);
                        var t = window.location.hash;
                        if (t) {
                            var s = this._getOriginalMenuId();
                            s && s == t.slice(1) && setTimeout(function() {
                                e.open()
                            }, 1e3)
                        }
                    }), this.bind("initExtensions:after", function() {
                        for (var e = [i.mm("widescreen"), i.mm("iconbar")], t = 0; t < e.length; t++)
                            for (var n in this.opts.extensions)
                                if (this.opts.extensions[n].indexOf(e[t]) > -1) {
                                    ! function(t, n) {
                                        s.matchMedia(t, function() {
                                            o.$html.addClass(e[n])
                                        }, function() {
                                            o.$html.removeClass(e[n])
                                        })
                                    }(n, t);
                                    break
                                }
                    }), this.bind("open:start:sr-aria", function() {
                        this.__sr_aria(this.$menu, "hidden", !1)
                    }), this.bind("close:finish:sr-aria", function() {
                        this.__sr_aria(this.$menu, "hidden", !0)
                    }), this.bind("initMenu:after:sr-aria", function() {
                        this.__sr_aria(this.$menu, "hidden", !0)
                    })
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("offcanvas slideout blocking modal background opening blocker page no-csstransforms3d"), s.add("style")
            },
            clickAnchor: function(e, t) {
                var s = this;
                if (this.opts[n]) {
                    var a = this._getOriginalMenuId();
                    if (a && e.is('[href="#' + a + '"]')) {
                        if (t) return !0;
                        var r = e.closest("." + i.menu);
                        if (r.length) {
                            var l = r.data("mmenu");
                            if (l && l.close) return l.close(), s.__transitionend(r, function() {
                                s.open()
                            }, s.conf.transitionDuration), !0
                        }
                        return this.open(), !0
                    }
                    if (o.$page) return a = o.$page.first().attr("id"), a && e.is('[href="#' + a + '"]') ? (this.close(), !0) : void 0
                }
            }
        }, e[t].defaults[n] = {
            position: "left",
            zposition: "back",
            blockUI: !0,
            moveBackground: !0
        }, e[t].configuration[n] = {
            pageNodetype: "div",
            pageSelector: null,
            noPageSelector: [],
            wrapPageIfNeeded: !0,
            menuInsertMethod: "prependTo",
            menuInsertSelector: "body"
        }, e[t].prototype.open = function() {
            if (this.trigger("open:before"), !this.vars.opened) {
                var e = this;
                this._openSetup(), setTimeout(function() {
                    e._openFinish()
                }, this.conf.openingInterval), this.trigger("open:after")
            }
        }, e[t].prototype._openSetup = function() {
            var t = this,
                r = this.opts[n];
            this.closeAllOthers(), o.$page.each(function() {
                e(this).data(s.style, e(this).attr("style") || "")
            }), o.$wndw.trigger(a.resize + "-" + n, [!0]);
            var l = [i.opened];
            r.blockUI && l.push(i.blocking), "modal" == r.blockUI && l.push(i.modal), r.moveBackground && l.push(i.background), "left" != r.position && l.push(i.mm(this.opts[n].position)), "back" != r.zposition && l.push(i.mm(this.opts[n].zposition)), o.$html.addClass(l.join(" ")), setTimeout(function() {
                t.vars.opened = !0
            }, this.conf.openingInterval), this.$menu.addClass(i.opened)
        }, e[t].prototype._openFinish = function() {
            var e = this;
            this.__transitionend(o.$page.first(), function() {
                e.trigger("open:finish")
            }, this.conf.transitionDuration), this.trigger("open:start"), o.$html.addClass(i.opening)
        }, e[t].prototype.close = function() {
            if (this.trigger("close:before"), this.vars.opened) {
                var t = this;
                this.__transitionend(o.$page.first(), function() {
                    t.$menu.removeClass(i.opened);
                    var a = [i.opened, i.blocking, i.modal, i.background, i.mm(t.opts[n].position), i.mm(t.opts[n].zposition)];
                    o.$html.removeClass(a.join(" ")), o.$page.each(function() {
                        e(this).attr("style", e(this).data(s.style))
                    }), t.vars.opened = !1, t.trigger("close:finish")
                }, this.conf.transitionDuration), this.trigger("close:start"), o.$html.removeClass(i.opening), this.trigger("close:after")
            }
        }, e[t].prototype.closeAllOthers = function() {
            o.$body.find("." + i.menu + "." + i.offcanvas).not(this.$menu).each(function() {
                var n = e(this).data(t);
                n && n.close && n.close()
            })
        }, e[t].prototype.setPage = function(t) {
            this.trigger("setPage:before", t);
            var s = this,
                a = this.conf[n];
            t && t.length || (t = o.$body.find(a.pageSelector), a.noPageSelector.length && (t = t.not(a.noPageSelector.join(", "))), t.length > 1 && a.wrapPageIfNeeded && (t = t.wrapAll("<" + this.conf[n].pageNodetype + " />").parent())), t.each(function() {
                e(this).attr("id", e(this).attr("id") || s.__getUniqueId())
            }), t.addClass(i.page + " " + i.slideout), o.$page = t, this.trigger("setPage:after", t)
        }, e[t].prototype["_initWindow_" + n] = function() {
            o.$wndw.off(a.keydown + "-" + n).on(a.keydown + "-" + n, function(e) {
                if (o.$html.hasClass(i.opened) && 9 == e.keyCode) return e.preventDefault(), !1
            });
            var e = 0;
            o.$wndw.off(a.resize + "-" + n).on(a.resize + "-" + n, function(t, n) {
                if (1 == o.$page.length && (n || o.$html.hasClass(i.opened))) {
                    var s = o.$wndw.height();
                    (n || s != e) && (e = s, o.$page.css("minHeight", s))
                }
            })
        }, e[t].prototype._initBlocker = function() {
            var t = this;
            this.opts[n].blockUI && (o.$blck || (o.$blck = e('<div id="' + i.blocker + '" class="' + i.slideout + '" />')), o.$blck.appendTo(o.$body).off(a.touchstart + "-" + n + " " + a.touchmove + "-" + n).on(a.touchstart + "-" + n + " " + a.touchmove + "-" + n, function(e) {
                e.preventDefault(), e.stopPropagation(), o.$blck.trigger(a.mousedown + "-" + n)
            }).off(a.mousedown + "-" + n).on(a.mousedown + "-" + n, function(e) {
                e.preventDefault(), o.$html.hasClass(i.modal) || (t.closeAllOthers(), t.close())
            }))
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu scrollBugFix add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "scrollBugFix";
        e[t].addons[n] = {
            setup: function() {
                var s = this.opts[n];
                this.conf[n];
                o = e[t].glbl, e[t].support.touch && this.opts.offCanvas && this.opts.offCanvas.blockUI && ("boolean" == typeof s && (s = {
                    fix: s
                }), "object" != typeof s && (s = {}), s = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], s), s.fix && (this.bind("open:start", function() {
                    this.$pnls.children("." + i.opened).scrollTop(0)
                }), this.bind("initMenu:after", function() {
                    this["_initWindow_" + n]()
                })))
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            fix: !0
        }, e[t].prototype["_initWindow_" + n] = function() {
            var t = this;
            o.$docu.off(a.touchmove + "-" + n).on(a.touchmove + "-" + n, function(e) {
                o.$html.hasClass(i.opened) && e.preventDefault()
            });
            var s = !1;
            o.$body.off(a.touchstart + "-" + n).on(a.touchstart + "-" + n, "." + i.panels + "> ." + i.panel, function(e) {
                o.$html.hasClass(i.opened) && (s || (s = !0, 0 === e.currentTarget.scrollTop ? e.currentTarget.scrollTop = 1 : e.currentTarget.scrollHeight === e.currentTarget.scrollTop + e.currentTarget.offsetHeight && (e.currentTarget.scrollTop -= 1), s = !1))
            }).off(a.touchmove + "-" + n).on(a.touchmove + "-" + n, "." + i.panels + "> ." + i.panel, function(t) {
                o.$html.hasClass(i.opened) && e(this)[0].scrollHeight > e(this).innerHeight() && t.stopPropagation()
            }), o.$wndw.off(a.orientationchange + "-" + n).on(a.orientationchange + "-" + n, function() {
                t.$pnls.children("." + i.opened).scrollTop(0).css({
                    "-webkit-overflow-scrolling": "auto"
                }).css({
                    "-webkit-overflow-scrolling": "touch"
                })
            })
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu screenReader add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "screenReader";
        e[t].addons[n] = {
            setup: function() {
                var a = this,
                    r = this.opts[n],
                    l = this.conf[n];
                o = e[t].glbl, "boolean" == typeof r && (r = {
                    aria: r,
                    text: r
                }), "object" != typeof r && (r = {}), r = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], r), r.aria && (this.bind("initAddons:after", function() {
                    this.bind("initMenu:after", function() {
                        this.trigger("initMenu:after:sr-aria")
                    }), this.bind("initNavbar:after", function() {
                        this.trigger("initNavbar:after:sr-aria", arguments[0])
                    }), this.bind("openPanel:start", function() {
                        this.trigger("openPanel:start:sr-aria", arguments[0])
                    }), this.bind("close:start", function() {
                        this.trigger("close:start:sr-aria")
                    }), this.bind("close:finish", function() {
                        this.trigger("close:finish:sr-aria")
                    }), this.bind("open:start", function() {
                        this.trigger("open:start:sr-aria")
                    }), this.bind("open:finish", function() {
                        this.trigger("open:finish:sr-aria")
                    })
                }), this.bind("updateListview", function() {
                    this.$pnls.find("." + i.listview).children().each(function() {
                        a.__sr_aria(e(this), "hidden", e(this).is("." + i.hidden))
                    })
                }), this.bind("openPanel:start", function(e) {
                    var t = this.$menu.find("." + i.panel).not(e).not(e.parents("." + i.panel)),
                        n = e.add(e.find("." + i.vertical + "." + i.opened).children("." + i.panel));
                    this.__sr_aria(t, "hidden", !0), this.__sr_aria(n, "hidden", !1)
                }), this.bind("closePanel", function(e) {
                    this.__sr_aria(e, "hidden", !0)
                }), this.bind("initPanels:after", function(t) {
                    var n = t.find("." + i.prev + ", ." + i.next).each(function() {
                        a.__sr_aria(e(this), "owns", e(this).attr("href").replace("#", ""))
                    });
                    this.__sr_aria(n, "haspopup", !0)
                }), this.bind("initNavbar:after", function(e) {
                    var t = e.children("." + i.navbar);
                    this.__sr_aria(t, "hidden", !e.hasClass(i.hasnavbar))
                }), r.text && (this.bind("initlistview:after", function(e) {
                    var t = e.find("." + i.listview).find("." + i.fullsubopen).parent().children("span");
                    this.__sr_aria(t, "hidden", !0)
                }), "parent" == this.opts.navbar.titleLink && this.bind("initNavbar:after", function(e) {
                    var t = e.children("." + i.navbar),
                        n = !!t.children("." + i.prev).length;
                    this.__sr_aria(t.children("." + i.title), "hidden", n)
                }))), r.text && (this.bind("initAddons:after", function() {
                    this.bind("setPage:after", function() {
                        this.trigger("setPage:after:sr-text", arguments[0])
                    })
                }), this.bind("initNavbar:after", function(n) {
                    var s = n.children("." + i.navbar),
                        a = s.children("." + i.title).text(),
                        o = e[t].i18n(l.text.closeSubmenu);
                    a && (o += " (" + a + ")"), s.children("." + i.prev).html(this.__sr_text(o))
                }), this.bind("initListview:after", function(n) {
                    var o = n.data(s.parent);
                    if (o && o.length) {
                        var r = o.children("." + i.next),
                            d = r.nextAll("span, a").first().text(),
                            c = e[t].i18n(l.text[r.parent().is("." + i.vertical) ? "toggleSubmenu" : "openSubmenu"]);
                        d && (c += " (" + d + ")"), r.html(a.__sr_text(c))
                    }
                }))
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("sronly")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            aria: !0,
            text: !0
        }, e[t].configuration[n] = {
            text: {
                closeMenu: "Close menu",
                closeSubmenu: "Close submenu",
                openSubmenu: "Open submenu",
                toggleSubmenu: "Toggle submenu"
            }
        }, e[t].prototype.__sr_aria = function(e, t, n) {
            e.prop("aria-" + t, n)[n ? "attr" : "removeAttr"]("aria-" + t, n)
        }, e[t].prototype.__sr_text = function(e) {
            return '<span class="' + i.sronly + '">' + e + "</span>"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu autoHeight add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "autoHeight";
        e[t].addons[n] = {
            setup: function() {
                var s = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof s && s && (s = {
                        height: "auto"
                    }), "string" == typeof s && (s = {
                        height: s
                    }), "object" != typeof s && (s = {}), s = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], s), "auto" == s.height || "highest" == s.height) {
                    this.bind("initMenu:after", function() {
                        this.$menu.addClass(i.autoheight)
                    });
                    var a = function(t) {
                        if (!this.opts.offCanvas || this.vars.opened) {
                            var n = Math.max(parseInt(this.$pnls.css("top"), 10), 0) || 0,
                                a = Math.max(parseInt(this.$pnls.css("bottom"), 10), 0) || 0,
                                o = 0;
                            this.$menu.addClass(i.measureheight), "auto" == s.height ? (t = t || this.$pnls.children("." + i.opened), t.is("." + i.vertical) && (t = t.parents("." + i.panel).not("." + i.vertical)), t.length || (t = this.$pnls.children("." + i.panel)), o = t.first().outerHeight()) : "highest" == s.height && this.$pnls.children().each(function() {
                                var t = e(this);
                                t.is("." + i.vertical) && (t = t.parents("." + i.panel).not("." + i.vertical).first()), o = Math.max(o, t.outerHeight())
                            }), this.$menu.height(o + n + a).removeClass(i.measureheight)
                        }
                    };
                    this.opts.offCanvas && this.bind("open:start", a), "highest" == s.height && this.bind("initPanels:after", a), "auto" == s.height && (this.bind("updateListview", a), this.bind("openPanel:start", a), this.bind("closePanel", a))
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("autoheight measureheight"), a.add("resize")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            height: "default"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu backButton add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "backButton";
        e[t].addons[n] = {
            setup: function() {
                if (this.opts.offCanvas) {
                    var s = this,
                        a = this.opts[n];
                    this.conf[n];
                    if (o = e[t].glbl, "boolean" == typeof a && (a = {
                            close: a
                        }), "object" != typeof a && (a = {}), a = e.extend(!0, {}, e[t].defaults[n], a), a.close) {
                        var r = "#" + s.$menu.attr("id");
                        this.bind("open:finish", function(e) {
                            location.hash != r && history.pushState(null, document.title, r)
                        }), e(window).on("popstate", function(e) {
                            o.$html.hasClass(i.opened) ? (e.stopPropagation(), s.close()) : location.hash == r && (e.stopPropagation(), s.open())
                        })
                    }
                }
            },
            add: function() {
                return window.history && window.history.pushState ? (i = e[t]._c, s = e[t]._d, void(a = e[t]._e)) : void(e[t].addons[n].setup = function() {})
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            close: !1
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu counters add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "counters";
        e[t].addons[n] = {
            setup: function() {
                var a = this,
                    r = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof r && (r = {
                        add: r,
                        update: r
                    }), "object" != typeof r && (r = {}), r = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], r), this.bind("initListview:after", function(t) {
                        this.__refactorClass(e("em", t), this.conf.classNames[n].counter, "counter")
                    }), r.add && this.bind("initListview:after", function(t) {
                        var n;
                        switch (r.addTo) {
                            case "panels":
                                n = t;
                                break;
                            default:
                                n = t.filter(r.addTo)
                        }
                        n.each(function() {
                            var t = e(this).data(s.parent);
                            t && (t.children("em." + i.counter).length || t.prepend(e('<em class="' + i.counter + '" />')))
                        })
                    }), r.update) {
                    var l = function(t) {
                        t = t || this.$pnls.children("." + i.panel), t.each(function() {
                            var t = e(this),
                                n = t.data(s.parent);
                            if (n) {
                                var o = n.children("em." + i.counter);
                                o.length && (t = t.children("." + i.listview), t.length && o.html(a.__filterListItems(t.children()).length))
                            }
                        })
                    };
                    this.bind("initListview:after", l), this.bind("updateListview", l)
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("counter search noresultsmsg")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            add: !1,
            addTo: "panels",
            count: !1
        }, e[t].configuration.classNames[n] = {
            counter: "Counter"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu columns add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "columns";
        e[t].addons[n] = {
            setup: function() {
                var s = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof s && (s = {
                        add: s
                    }), "number" == typeof s && (s = {
                        add: !0,
                        visible: s
                    }), "object" != typeof s && (s = {}), "number" == typeof s.visible && (s.visible = {
                        min: s.visible,
                        max: s.visible
                    }), s = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], s), s.add) {
                    s.visible.min = Math.max(1, Math.min(6, s.visible.min)), s.visible.max = Math.max(s.visible.min, Math.min(6, s.visible.max));
                    for (var a = this.opts.offCanvas ? this.$menu.add(o.$html) : this.$menu, r = "", l = 0; l <= s.visible.max; l++) r += " " + i.columns + "-" + l;
                    r.length && (r = r.slice(1));
                    var d = function(e) {
                            var t = this.$pnls.children("." + i.subopened).length;
                            e && !e.hasClass(i.subopened) && t++, t = Math.min(s.visible.max, Math.max(s.visible.min, t)), a.removeClass(r).addClass(i.columns + "-" + t)
                        },
                        c = function(t) {
                            t = t || this.$pnls.children("." + i.opened), this.$pnls.children("." + i.panel).removeClass(r).filter("." + i.subopened).add(t).slice(-s.visible.max).each(function(t) {
                                e(this).addClass(i.columns + "-" + t)
                            })
                        };
                    this.bind("initMenu:after", function() {
                        this.$menu.addClass(i.columns)
                    }), this.bind("openPanel:start", d), this.bind("openPanel:start", c)
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("columns")
            },
            clickAnchor: function(t, s) {
                if (!this.opts[n].add) return !1;
                if (s) {
                    var a = t.attr("href");
                    if (a.length > 1 && "#" == a.slice(0, 1)) try {
                        var o = e(a, this.$menu);
                        if (o.is("." + i.panel))
                            for (var r = parseInt(t.closest("." + i.panel).attr("class").split(i.columns + "-")[1].split(" ")[0], 10) + 1; r > 0;) {
                                var l = this.$pnls.children("." + i.columns + "-" + r);
                                if (!l.length) {
                                    r = -1;
                                    break
                                }
                                r++, l.removeClass(i.subopened).removeClass(i.opened).removeClass(i.highest).addClass(i.hidden)
                            }
                    } catch (d) {}
                }
            }
        }, e[t].defaults[n] = {
            add: !1,
            visible: {
                min: 1,
                max: 3
            }
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu dividers add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "dividers";
        e[t].addons[n] = {
            setup: function() {
                var s = this,
                    r = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof r && (r = {
                        add: r,
                        fixed: r
                    }), "object" != typeof r && (r = {}), r = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], r), this.bind("initListview:after", function(e) {
                        this.__refactorClass(e.find("li"), this.conf.classNames[n].collapsed, "collapsed")
                    }), r.add && this.bind("initListview:after", function(t) {
                        var n;
                        switch (r.addTo) {
                            case "panels":
                                n = t;
                                break;
                            default:
                                n = t.filter(r.addTo)
                        }
                        n.length && n.find("." + i.listview).find("." + i.divider).remove().end().each(function() {
                            var t = "";
                            s.__filterListItems(e(this).children()).each(function() {
                                var n = e.trim(e(this).children("a, span").text()).slice(0, 1).toLowerCase();
                                n != t && n.length && (t = n, e('<li class="' + i.divider + '">' + n + "</li>").insertBefore(this))
                            })
                        })
                    }), r.collapse && this.bind("initListview:after", function(t) {
                        t.find("." + i.divider).each(function() {
                            var t = e(this),
                                n = t.nextUntil("." + i.divider, "." + i.collapsed);
                            n.length && (t.children("." + i.next).length || (t.wrapInner("<span />"), t.prepend('<a href="#" class="' + i.next + " " + i.fullsubopen + '" />')))
                        })
                    }), r.fixed) {
                    this.bind("initPanels:after", function() {
                        "undefined" == typeof this.$fixeddivider && (this.$fixeddivider = e('<ul class="' + i.listview + " " + i.fixeddivider + '"><li class="' + i.divider + '"></li></ul>').prependTo(this.$pnls).children())
                    });
                    var l = function(t) {
                        if (t = t || this.$pnls.children("." + i.opened), !t.is(":hidden")) {
                            var n = t.children("." + i.listview).children("." + i.divider).not("." + i.hidden),
                                s = t.scrollTop() || 0,
                                a = "";
                            n.each(function() {
                                e(this).position().top + s < s + 1 && (a = e(this).text())
                            }), this.$fixeddivider.text(a), this.$pnls[a.length ? "addClass" : "removeClass"](i.hasdividers)
                        }
                    };
                    this.bind("open:start", l), this.bind("openPanel:start", l), this.bind("updateListview", l), this.bind("initPanel:after", function(e) {
                        e.off(a.scroll + "-" + n + " " + a.touchmove + "-" + n).on(a.scroll + "-" + n + " " + a.touchmove + "-" + n, function(t) {
                            l.call(s, e)
                        })
                    })
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("collapsed uncollapsed fixeddivider hasdividers"), a.add("scroll")
            },
            clickAnchor: function(e, t) {
                if (this.opts[n].collapse && t) {
                    var s = e.parent();
                    if (s.is("." + i.divider)) {
                        var a = s.nextUntil("." + i.divider, "." + i.collapsed);
                        return s.toggleClass(i.opened), a[s.hasClass(i.opened) ? "addClass" : "removeClass"](i.uncollapsed), !0
                    }
                }
                return !1
            }
        }, e[t].defaults[n] = {
            add: !1,
            addTo: "panels",
            fixed: !1,
            collapse: !1
        }, e[t].configuration.classNames[n] = {
            collapsed: "Collapsed"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu drag add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        function t(e, t, n) {
            return e < t && (e = t), e > n && (e = n), e
        }

        function n(n, i, s) {
            var r, l, d, c = this,
                h = {
                    events: "panleft panright",
                    typeLower: "x",
                    typeUpper: "X",
                    open_dir: "right",
                    close_dir: "left",
                    negative: !1
                },
                f = "width",
                u = h.open_dir,
                p = function(e) {
                    e <= n.maxStartPos && (m = 1)
                },
                v = function() {
                    return e("." + o.slideout)
                },
                m = 0,
                b = 0,
                g = 0;
            switch (this.opts.offCanvas.position) {
                case "top":
                case "bottom":
                    h.events = "panup pandown", h.typeLower = "y", h.typeUpper = "Y", f = "height"
            }
            switch (this.opts.offCanvas.position) {
                case "right":
                case "bottom":
                    h.negative = !0, p = function(e) {
                        e >= s.$wndw[f]() - n.maxStartPos && (m = 1)
                    }
            }
            switch (this.opts.offCanvas.position) {
                case "left":
                    break;
                case "right":
                    h.open_dir = "left", h.close_dir = "right";
                    break;
                case "top":
                    h.open_dir = "down", h.close_dir = "up";
                    break;
                case "bottom":
                    h.open_dir = "up", h.close_dir = "down"
            }
            switch (this.opts.offCanvas.zposition) {
                case "front":
                    v = function() {
                        return this.$menu
                    }
            }
            var _ = this.__valueOrFn(n.node, this.$menu, s.$page);
            "string" == typeof _ && (_ = e(_));
            var y = new Hammer(_[0], this.opts[a].vendors.hammer);
            y.on("panstart", function(e) {
                p(e.center[h.typeLower]), s.$slideOutNodes = v(), u = h.open_dir
            }), y.on(h.events + " panend", function(e) {
                m > 0 && e.preventDefault()
            }), y.on(h.events, function(e) {
                if (r = e["delta" + h.typeUpper], h.negative && (r = -r), r != b && (u = r >= b ? h.open_dir : h.close_dir), b = r, b > n.threshold && 1 == m) {
                    if (s.$html.hasClass(o.opened)) return;
                    m = 2, c._openSetup(), c.trigger("open:start"), s.$html.addClass(o.dragging), g = t(s.$wndw[f]() * i[f].perc, i[f].min, i[f].max)
                }
                2 == m && (l = t(b, 10, g) - ("front" == c.opts.offCanvas.zposition ? g : 0), h.negative && (l = -l), d = "translate" + h.typeUpper + "(" + l + "px )", s.$slideOutNodes.css({
                    "-webkit-transform": "-webkit-" + d,
                    transform: d
                }))
            }), y.on("panend", function(e) {
                2 == m && (s.$html.removeClass(o.dragging), s.$slideOutNodes.css("transform", ""), c[u == h.open_dir ? "_openFinish" : "close"]()), m = 0
            })
        }

        function i(e, t, n, i) {
            var s = this,
                l = e.data(r.parent);
            if (l) {
                l = l.closest("." + o.panel);
                var d = new Hammer(e[0], s.opts[a].vendors.hammer),
                    c = null;
                d.on("panright", function(e) {
                    c || (s.openPanel(l), c = setTimeout(function() {
                        clearTimeout(c), c = null
                    }, s.conf.openingInterval + s.conf.transitionDuration))
                })
            }
        }
        var s = "mmenu",
            a = "drag";
        e[s].addons[a] = {
            setup: function() {
                if (this.opts.offCanvas) {
                    var t = this.opts[a],
                        o = this.conf[a];
                    d = e[s].glbl, "boolean" == typeof t && (t = {
                        menu: t,
                        panels: t
                    }), "object" != typeof t && (t = {}), "boolean" == typeof t.menu && (t.menu = {
                        open: t.menu
                    }), "object" != typeof t.menu && (t.menu = {}), "boolean" == typeof t.panels && (t.panels = {
                        close: t.panels
                    }), "object" != typeof t.panels && (t.panels = {}), t = this.opts[a] = e.extend(!0, {}, e[s].defaults[a], t), t.menu.open && this.bind("setPage:after", function() {
                        n.call(this, t.menu, o.menu, d)
                    }), t.panels.close && this.bind("initPanel:after", function(e) {
                        i.call(this, e, t.panels, o.panels, d)
                    })
                }
            },
            add: function() {
                return "function" != typeof Hammer || Hammer.VERSION < 2 ? (e[s].addons[a].add = function() {}, void(e[s].addons[a].setup = function() {})) : (o = e[s]._c, r = e[s]._d, l = e[s]._e, void o.add("dragging"))
            },
            clickAnchor: function(e, t) {}
        }, e[s].defaults[a] = {
            menu: {
                open: !1,
                maxStartPos: 100,
                threshold: 50
            },
            panels: {
                close: !1
            },
            vendors: {
                hammer: {}
            }
        }, e[s].configuration[a] = {
            menu: {
                width: {
                    perc: .8,
                    min: 140,
                    max: 440
                },
                height: {
                    perc: .8,
                    min: 140,
                    max: 880
                }
            },
            panels: {}
        };
        var o, r, l, d
    }(jQuery),
    /*
     * jQuery mmenu dropdown add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "dropdown";
        e[t].addons[n] = {
            setup: function() {
                if (this.opts.offCanvas) {
                    var r = this,
                        l = this.opts[n],
                        d = this.conf[n];
                    if (o = e[t].glbl, "boolean" == typeof l && l && (l = {
                            drop: l
                        }), "object" != typeof l && (l = {}), "string" == typeof l.position && (l.position = {
                            of: l.position
                        }), l = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], l), l.drop) {
                        var c;
                        this.bind("initMenu:after", function() {
                            if (this.$menu.addClass(i.dropdown), l.tip && this.$menu.addClass(i.tip), "string" != typeof l.position.of) {
                                var t = this._getOriginalMenuId();
                                t && t.length && (l.position.of = '[href="#' + t + '"]')
                            }
                            "string" == typeof l.position.of && (c = e(l.position.of), l.event = l.event.split(" "), 1 == l.event.length && (l.event[1] = l.event[0]), "hover" == l.event[0] && c.on(a.mouseenter + "-" + n, function() {
                                r.open()
                            }), "hover" == l.event[1] && this.$menu.on(a.mouseleave + "-" + n, function() {
                                r.close()
                            }))
                        }), this.bind("open:start", function() {
                            this.$menu.data(s.style, this.$menu.attr("style") || ""), o.$html.addClass(i.dropdown)
                        }), this.bind("close:finish", function() {
                            this.$menu.attr("style", this.$menu.data(s.style)), o.$html.removeClass(i.dropdown)
                        });
                        var h = function(e, t) {
                                var n = t[0],
                                    s = t[1],
                                    a = "x" == e ? "scrollLeft" : "scrollTop",
                                    r = "x" == e ? "outerWidth" : "outerHeight",
                                    h = "x" == e ? "left" : "top",
                                    f = "x" == e ? "right" : "bottom",
                                    u = "x" == e ? "width" : "height",
                                    p = "x" == e ? "maxWidth" : "maxHeight",
                                    v = null,
                                    m = o.$wndw[a](),
                                    b = c.offset()[h] -= m,
                                    g = b + c[r](),
                                    _ = o.$wndw[u](),
                                    y = d.offset.button[e] + d.offset.viewport[e];
                                if (l.position[e]) switch (l.position[e]) {
                                    case "left":
                                    case "bottom":
                                        v = "after";
                                        break;
                                    case "right":
                                    case "top":
                                        v = "before"
                                }
                                null === v && (v = b + (g - b) / 2 < _ / 2 ? "after" : "before");
                                var C, w;
                                return "after" == v ? (C = "x" == e ? b : g, w = _ - (C + y), n[h] = C + d.offset.button[e], n[f] = "auto", s.push(i["x" == e ? "tipleft" : "tiptop"])) : (C = "x" == e ? g : b, w = C - y, n[f] = "calc( 100% - " + (C - d.offset.button[e]) + "px )", n[h] = "auto", s.push(i["x" == e ? "tipright" : "tipbottom"])), n[p] = Math.min(d[u].max, w), [n, s]
                            },
                            f = function(e) {
                                if (this.vars.opened) {
                                    this.$menu.attr("style", this.$menu.data(s.style));
                                    var t = [{},
                                        []
                                    ];
                                    t = h.call(this, "y", t), t = h.call(this, "x", t), this.$menu.css(t[0]), l.tip && this.$menu.removeClass(i.tipleft + " " + i.tipright + " " + i.tiptop + " " + i.tipbottom).addClass(t[1].join(" "))
                                }
                            };
                        this.bind("open:start", f), o.$wndw.on(a.resize + "-" + n, function(e) {
                            f.call(r)
                        }), this.opts.offCanvas.blockUI || o.$wndw.on(a.scroll + "-" + n, function(e) {
                            f.call(r)
                        })
                    }
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("dropdown tip tipleft tipright tiptop tipbottom"), a.add("mouseenter mouseleave resize scroll")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            drop: !1,
            event: "click",
            position: {},
            tip: !0
        }, e[t].configuration[n] = {
            offset: {
                button: {
                    x: -10,
                    y: 10
                },
                viewport: {
                    x: 20,
                    y: 20
                }
            },
            height: {
                max: 880
            },
            width: {
                max: 440
            }
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu fixedElements add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "fixedElements";
        e[t].addons[n] = {
            setup: function() {
                if (this.opts.offCanvas) {
                    var s = (this.opts[n], this.conf[n]);
                    o = e[t].glbl;
                    var a = function(t) {
                        var a = this.conf.classNames[n].fixed,
                            r = t.find("." + a);
                        this.__refactorClass(r, a, "slideout"), r[s.elemInsertMethod](s.elemInsertSelector);
                        var l = this.conf.classNames[n].sticky,
                            d = t.find("." + l);
                        this.__refactorClass(d, l, "sticky"), d = t.find("." + i.sticky), d.length && (this.bind("open:before", function() {
                            var t = o.$wndw.scrollTop() + s.sticky.offset;
                            d.each(function() {
                                e(this).css("top", parseInt(e(this).css("top"), 10) + t)
                            })
                        }), this.bind("close:finish", function() {
                            d.css("top", "")
                        }))
                    };
                    this.bind("setPage:after", a)
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("sticky")
            },
            clickAnchor: function(e, t) {}
        }, e[t].configuration[n] = {
            sticky: {
                offset: 0
            },
            elemInsertMethod: "appendTo",
            elemInsertSelector: "body"
        }, e[t].configuration.classNames[n] = {
            fixed: "Fixed",
            sticky: "Sticky"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu iconPanels add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "iconPanels";
        e[t].addons[n] = {
            setup: function() {
                var s = this,
                    a = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof a && (a = {
                        add: a
                    }), "number" == typeof a && (a = {
                        add: !0,
                        visible: a
                    }), "object" != typeof a && (a = {}), a = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], a), a.visible++, a.add) {
                    for (var r = "", l = 0; l <= a.visible; l++) r += " " + i.iconpanel + "-" + l;
                    r.length && (r = r.slice(1));
                    var d = function(t) {
                        t.hasClass(i.vertical) || s.$pnls.children("." + i.panel).removeClass(r).filter("." + i.subopened).removeClass(i.hidden).add(t).not("." + i.vertical).slice(-a.visible).each(function(t) {
                            e(this).addClass(i.iconpanel + "-" + t)
                        })
                    };
                    this.bind("initMenu:after", function() {
                        this.$menu.addClass(i.iconpanel)
                    }), this.bind("openPanel:start", d), this.bind("initPanels:after", function(e) {
                        d.call(s, s.$pnls.children("." + i.opened))
                    }), this.bind("initListview:after", function(e) {
                        e.hasClass(i.vertical) || e.children("." + i.subblocker).length || e.prepend('<a href="#' + e.closest("." + i.panel).attr("id") + '" class="' + i.subblocker + '" />')
                    })
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("iconpanel subblocker")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            add: !1,
            visible: 3
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu keyboardNavigation add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        function t(t, n) {
            t = t || this.$pnls.children("." + a.opened);
            var i = e(),
                s = this.$menu.children("." + a.mm("navbars-top") + ", ." + a.mm("navbars-bottom")).children("." + a.navbar);
            s.find(d).filter(":focus").length || ("default" == n && (i = t.children("." + a.listview).find("a[href]").not("." + a.hidden), i.length || (i = t.find(d).not("." + a.hidden)), i.length || (i = s.find(d).not("." + a.hidden))), i.length || (i = this.$menu.children("." + a.tabstart)), i.first().focus())
        }

        function n(e) {
            e || (e = this.$pnls.children("." + a.opened));
            var t = this.$pnls.children("." + a.panel),
                n = t.not(e);
            n.find(d).attr("tabindex", -1), e.find(d).attr("tabindex", 0), e.find("." + a.mm("toggle") + ", ." + a.mm("check")).attr("tabindex", -1), e.children("." + a.navbar).children("." + a.title).attr("tabindex", -1)
        }
        var i = "mmenu",
            s = "keyboardNavigation";
        e[i].addons[s] = {
            setup: function() {
                if (!e[i].support.touch) {
                    var o = this.opts[s];
                    this.conf[s];
                    if (l = e[i].glbl, "boolean" != typeof o && "string" != typeof o || (o = {
                            enable: o
                        }), "object" != typeof o && (o = {}), o = this.opts[s] = e.extend(!0, {}, e[i].defaults[s], o), o.enable) {
                        var r = e('<button class="' + a.tabstart + '" tabindex="0" type="button" />'),
                            d = e('<button class="' + a.tabend + '" tabindex="0" type="button" />');
                        this.bind("initMenu:after", function() {
                            o.enhance && this.$menu.addClass(a.keyboardfocus), this["_initWindow_" + s](o.enhance)
                        }), this.bind("initOpened:before", function() {
                            this.$menu.prepend(r).append(d).children("." + a.mm("navbars-top") + ", ." + a.mm("navbars-bottom")).children("." + a.navbar).children("a." + a.title).attr("tabindex", -1)
                        }), this.bind("open:start", function() {
                            n.call(this)
                        }), this.bind("open:finish", function() {
                            t.call(this, null, o.enable)
                        }), this.bind("openPanel:start", function(e) {
                            n.call(this, e)
                        }), this.bind("openPanel:finish", function(e) {
                            t.call(this, e, o.enable)
                        }), this.bind("initOpened:after", function() {
                            this.__sr_aria(this.$menu.children("." + a.mm("tabstart") + ", ." + a.mm("tabend")), "hidden", !0)
                        })
                    }
                }
            },
            add: function() {
                a = e[i]._c, o = e[i]._d, r = e[i]._e, a.add("tabstart tabend keyboardfocus"), r.add("focusin keydown")
            },
            clickAnchor: function(e, t) {}
        }, e[i].defaults[s] = {
            enable: !1,
            enhance: !1
        }, e[i].configuration[s] = {}, e[i].prototype["_initWindow_" + s] = function(t) {
            l.$wndw.off(r.keydown + "-offCanvas"), l.$wndw.off(r.focusin + "-" + s).on(r.focusin + "-" + s, function(t) {
                if (l.$html.hasClass(a.opened)) {
                    var n = e(t.target);
                    n.is("." + a.tabend) && n.parent().find("." + a.tabstart).focus()
                }
            }), l.$wndw.off(r.keydown + "-" + s).on(r.keydown + "-" + s, function(t) {
                var n = e(t.target),
                    i = n.closest("." + a.menu);
                if (i.length) {
                    i.data("mmenu");
                    if (n.is("input, textarea"));
                    else switch (t.keyCode) {
                        case 13:
                            (n.is(".mm-toggle") || n.is(".mm-check")) && n.trigger(r.click);
                            break;
                        case 32:
                        case 37:
                        case 38:
                        case 39:
                        case 40:
                            t.preventDefault()
                    }
                }
            }), t && l.$wndw.off(r.keydown + "-" + s).on(r.keydown + "-" + s, function(t) {
                var n = e(t.target),
                    i = n.closest("." + a.menu);
                if (i.length) {
                    var s = i.data("mmenu");
                    if (n.is("input, textarea")) switch (t.keyCode) {
                        case 27:
                            n.val("")
                    } else switch (t.keyCode) {
                        case 8:
                            var r = n.closest("." + a.panel).data(o.parent);
                            r && r.length && s.openPanel(r.closest("." + a.panel));
                            break;
                        case 27:
                            i.hasClass(a.offcanvas) && s.close()
                    }
                }
            })
        };
        var a, o, r, l, d = "input, select, textarea, button, label, a[href]"
    }(jQuery),
    /*
     * jQuery mmenu lazySubmenus add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "lazySubmenus";
        e[t].addons[n] = {
            setup: function() {
                var s = this.opts[n];
                this.conf[n];
                o = e[t].glbl, "boolean" == typeof s && (s = {
                    load: s
                }), "object" != typeof s && (s = {}), s = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], s), s.load && (this.bind("initMenu:after", function() {
                    this.$pnls.find("li").children(this.conf.panelNodetype).not("." + i.inset).not("." + i.nolistview).not("." + i.nopanel).addClass(i.lazysubmenu + " " + i.nolistview + " " + i.nopanel)
                }), this.bind("initPanels:before", function(e) {
                    e = e || this.$pnls.children(this.conf.panelNodetype), this.__findAddBack(e, "." + i.lazysubmenu).not("." + i.lazysubmenu + " ." + i.lazysubmenu).removeClass(i.lazysubmenu + " " + i.nolistview + " " + i.nopanel)
                }), this.bind("initOpened:before", function() {
                    var e = this.$pnls.find("." + this.conf.classNames.selected).parents("." + i.lazysubmenu);
                    e.length && (e.removeClass(i.lazysubmenu + " " + i.nolistview + " " + i.nopanel), this.initPanels(e.last()))
                }), this.bind("openPanel:before", function(e) {
                    var t = this.__findAddBack(e, "." + i.lazysubmenu).not("." + i.lazysubmenu + " ." + i.lazysubmenu);
                    t.length && this.initPanels(t)
                }))
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("lazysubmenu"), s.add("lazysubmenu")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            load: !1
        }, e[t].configuration[n] = {};
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars";
        e[t].addons[n] = {
            setup: function() {
                var s = this,
                    a = this.opts[n],
                    r = this.conf[n];
                if (o = e[t].glbl, "undefined" != typeof a) {
                    a instanceof Array || (a = [a]);
                    var l = {},
                        d = {};
                    a.length && (e.each(a, function(o) {
                        var c = a[o];
                        "boolean" == typeof c && c && (c = {}), "object" != typeof c && (c = {}), "undefined" == typeof c.content && (c.content = ["prev", "title"]), c.content instanceof Array || (c.content = [c.content]), c = e.extend(!0, {}, s.opts.navbar, c);
                        var h = e('<div class="' + i.navbar + '" />'),
                            f = c.height;
                        "number" != typeof f && (f = 1), f = Math.min(4, Math.max(1, f)), h.addClass(i.navbar + "-size-" + f);
                        var u = c.position;
                        "bottom" != u && (u = "top"), l[u] || (l[u] = 0), l[u] += f, d[u] || (d[u] = e('<div class="' + i.navbars + "-" + u + '" />')), d[u].append(h);
                        for (var p = 0, v = 0, m = c.content.length; v < m; v++) {
                            var b = e[t].addons[n][c.content[v]] || !1;
                            b ? p += b.call(s, h, c, r) : (b = c.content[v], b instanceof e || (b = e(c.content[v])), h.append(b))
                        }
                        p += Math.ceil(h.children().not("." + i.btn).length / f), p > 1 && h.addClass(i.navbar + "-content-" + p), h.children("." + i.btn).length && h.addClass(i.hasbtns)
                    }), this.bind("initMenu:after", function() {
                        for (var e in l) this.$menu.addClass(i.hasnavbar + "-" + e + "-" + l[e]), this.$menu["bottom" == e ? "append" : "prepend"](d[e])
                    }))
                }
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("navbars close hasbtns")
            },
            clickAnchor: function(e, t) {}
        }, e[t].configuration[n] = {
            breadcrumbSeparator: "/"
        }, e[t].configuration.classNames[n] = {};
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on breadcrumbs content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "breadcrumbs";
        e[t].addons[n][i] = function(n, i, s) {
            var a = this,
                o = e[t]._c,
                r = e[t]._d;
            o.add("breadcrumbs separator");
            var l = e('<span class="' + o.breadcrumbs + '" />').appendTo(n);
            return this.bind("initNavbar:after", function(t) {
                t.removeClass(o.hasnavbar);
                for (var n = [], i = e('<span class="' + o.breadcrumbs + '"></span>'), a = t, l = !0; a && a.length;) {
                    if (a.is("." + o.panel) || (a = a.closest("." + o.panel)), !a.hasClass(o.vertical)) {
                        var d = a.children("." + o.navbar).children("." + o.title).text();
                        n.unshift(l ? "<span>" + d + "</span>" : '<a href="#' + a.attr("id") + '">' + d + "</a>"), l = !1
                    }
                    a = a.data(r.parent)
                }
                i.append(n.join('<span class="' + o.separator + '">' + s.breadcrumbSeparator + "</span>")).appendTo(t.children("." + o.navbar))
            }), this.bind("openPanel:start", function(e) {
                l.html(e.children("." + o.navbar).children("." + o.breadcrumbs).html() || "")
            }), this.bind("initNavbar:after:sr-aria", function(t) {
                t.children("." + o.navbar).children("." + o.breadcrumbs).children("a").each(function() {
                    a.__sr_aria(e(this), "owns", e(this).attr("href").slice(1))
                })
            }), 0
        }
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on close content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "close";
        e[t].addons[n][i] = function(n, i) {
            var s = e[t]._c,
                a = (e[t].glbl, e('<a class="' + s.close + " " + s.btn + '" href="#" />').appendTo(n));
            return this.bind("setPage:after", function(e) {
                a.attr("href", "#" + e.attr("id"))
            }), this.bind("setPage:after:sr-text", function(n) {
                a.html(this.__sr_text(e[t].i18n(this.conf.screenReader.text.closeMenu))), this.__sr_aria(a, "owns", a.attr("href").slice(1))
            }), -1
        }
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on next content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "next";
        e[t].addons[n][i] = function(i, s) {
            var a, o, r, l = e[t]._c,
                d = e('<a class="' + l.next + " " + l.btn + '" href="#" />').appendTo(i);
            return this.bind("openPanel:start", function(e) {
                a = e.find("." + this.conf.classNames[n].panelNext), o = a.attr("href"), r = a.html(), o ? d.attr("href", o) : d.removeAttr("href"), d[o || r ? "removeClass" : "addClass"](l.hidden), d.html(r)
            }), this.bind("openPanel:start:sr-aria", function(e) {
                this.__sr_aria(d, "hidden", d.hasClass(l.hidden)), this.__sr_aria(d, "owns", (d.attr("href") || "").slice(1))
            }), -1
        }, e[t].configuration.classNames[n].panelNext = "Next"
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on prev content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "prev";
        e[t].addons[n][i] = function(i, s) {
            var a = e[t]._c,
                o = e('<a class="' + a.prev + " " + a.btn + '" href="#" />').appendTo(i);
            this.bind("initNavbar:after", function(e) {
                e.removeClass(a.hasnavbar)
            });
            var r, l, d;
            return this.bind("openPanel:start", function(e) {
                e.hasClass(a.vertical) || (r = e.find("." + this.conf.classNames[n].panelPrev), r.length || (r = e.children("." + a.navbar).children("." + a.prev)), l = r.attr("href"), d = r.html(), l ? o.attr("href", l) : o.removeAttr("href"), o[l || d ? "removeClass" : "addClass"](a.hidden), o.html(d))
            }), this.bind("initNavbar:after:sr-aria", function(e) {
                var t = e.children("." + a.navbar);
                this.__sr_aria(t, "hidden", !0)
            }), this.bind("openPanel:start:sr-aria", function(e) {
                this.__sr_aria(o, "hidden", o.hasClass(a.hidden)), this.__sr_aria(o, "owns", (o.attr("href") || "").slice(1))
            }), -1
        }, e[t].configuration.classNames[n].panelPrev = "Prev"
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on searchfield content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "searchfield";
        e[t].addons[n][i] = function(n, i) {
            var s = e[t]._c,
                a = e('<div class="' + s.search + '" />').appendTo(n);
            return "object" != typeof this.opts.searchfield && (this.opts.searchfield = {}), this.opts.searchfield.add = !0, this.opts.searchfield.addTo = a, 0
        }
    }(jQuery),
    /*
     * jQuery mmenu navbar add-on title content
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "navbars",
            i = "title";
        e[t].addons[n][i] = function(i, s) {
            var a, o, r, l = e[t]._c,
                d = e('<a class="' + l.title + '" />').appendTo(i);
            this.bind("openPanel:start", function(e) {
                e.hasClass(l.vertical) || (r = e.find("." + this.conf.classNames[n].panelTitle), r.length || (r = e.children("." + l.navbar).children("." + l.title)), a = r.attr("href"), o = r.html() || s.title, a ? d.attr("href", a) : d.removeAttr("href"), d[a || o ? "removeClass" : "addClass"](l.hidden), d.html(o))
            });
            var c;
            return this.bind("openPanel:start:sr-aria", function(e) {
                if (this.opts.screenReader.text && (c || (c = this.$menu.children("." + l.navbars + "-top, ." + l.navbars + "-bottom").children("." + l.navbar).children("." + l.prev)), c.length)) {
                    var t = !0;
                    "parent" == this.opts.navbar.titleLink && (t = !c.hasClass(l.hidden)), this.__sr_aria(d, "hidden", t)
                }
            }), 0
        }, e[t].configuration.classNames[n].panelTitle = "Title"
    }(jQuery),
    /*
     * jQuery mmenu pageScroll add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        function t(e) {
            d && d.length && d.is(":visible") && l.$html.add(l.$body).animate({
                scrollTop: d.offset().top + e
            }), d = !1
        }

        function n(e) {
            try {
                return !("#" == e || "#" != e.slice(0, 1) || !l.$page.find(e).length)
            } catch (t) {
                return !1
            }
        }
        var i = "mmenu",
            s = "pageScroll";
        e[i].addons[s] = {
            setup: function() {
                var o = this,
                    d = this.opts[s],
                    c = this.conf[s];
                if (l = e[i].glbl, "boolean" == typeof d && (d = {
                        scroll: d
                    }), d = this.opts[s] = e.extend(!0, {}, e[i].defaults[s], d), d.scroll && this.bind("close:finish", function() {
                        t(c.scrollOffset)
                    }), d.update) {
                    var o = this,
                        h = [],
                        f = [];
                    o.bind("initListview:after", function(t) {
                        o.__filterListItemAnchors(t.find("." + a.listview).children("li")).each(function() {
                            var t = e(this).attr("href");
                            n(t) && h.push(t)
                        }), f = h.reverse()
                    });
                    var u = -1;
                    l.$wndw.on(r.scroll + "-" + s, function(t) {
                        for (var n = l.$wndw.scrollTop(), i = 0; i < f.length; i++)
                            if (e(f[i]).offset().top < n + c.updateOffset) {
                                u !== i && (u = i, o.setSelected(o.__filterListItemAnchors(o.$pnls.children("." + a.opened).find("." + a.listview).children("li")).filter('[href="' + f[i] + '"]').parent()));
                                break
                            }
                    })
                }
            },
            add: function() {
                a = e[i]._c, o = e[i]._d, r = e[i]._e
            },
            clickAnchor: function(i, o) {
                if (d = !1, o && this.opts[s].scroll && this.opts.offCanvas && l.$page && l.$page.length) {
                    var r = i.attr("href");
                    n(r) && (d = e(r), l.$html.hasClass(a.mm("widescreen")) && t(this.conf[s].scrollOffset))
                }
            }
        }, e[i].defaults[s] = {
            scroll: !1,
            update: !1
        }, e[i].configuration[s] = {
            scrollOffset: 0,
            updateOffset: 50
        };
        var a, o, r, l, d = !1
    }(jQuery),
    /*
     * jQuery mmenu RTL add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "rtl";
        e[t].addons[n] = {
            setup: function() {
                var s = this.opts[n];
                this.conf[n];
                o = e[t].glbl, "object" != typeof s && (s = {
                    use: s
                }), s = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], s), "boolean" != typeof s.use && (s.use = "rtl" == (o.$html.attr("dir") || "").toLowerCase()), s.use && this.bind("initMenu:after", function() {
                    this.$menu.addClass(i.rtl)
                })
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("rtl")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            use: "detect"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu searchfield add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        function t(e) {
            switch (e) {
                case 9:
                case 16:
                case 17:
                case 18:
                case 37:
                case 38:
                case 39:
                case 40:
                    return !0
            }
            return !1
        }
        var n = "mmenu",
            i = "searchfield";
        e[n].addons[i] = {
            setup: function() {
                var l = this,
                    d = this.opts[i],
                    c = this.conf[i];
                r = e[n].glbl, "boolean" == typeof d && (d = {
                    add: d
                }), "object" != typeof d && (d = {}), "boolean" == typeof d.resultsPanel && (d.resultsPanel = {
                    add: d.resultsPanel
                }), d = this.opts[i] = e.extend(!0, {}, e[n].defaults[i], d), c = this.conf[i] = e.extend(!0, {}, e[n].configuration[i], c), this.bind("close:start", function() {
                    this.$menu.find("." + s.search).find("input").blur()
                }), this.bind("initPanels:after", function(r) {
                    if (d.add) {
                        var h;
                        switch (d.addTo) {
                            case "panels":
                                h = r;
                                break;
                            default:
                                h = this.$menu.find(d.addTo)
                        }
                        if (h.each(function() {
                                var t = e(this);
                                if (!t.is("." + s.panel) || !t.is("." + s.vertical)) {
                                    if (!t.children("." + s.search).length) {
                                        var i = l.__valueOrFn(c.clear, t),
                                            a = l.__valueOrFn(c.form, t),
                                            r = l.__valueOrFn(c.input, t),
                                            h = l.__valueOrFn(c.submit, t),
                                            f = e("<" + (a ? "form" : "div") + ' class="' + s.search + '" />'),
                                            u = e('<input placeholder="' + e[n].i18n(d.placeholder) + '" type="text" autocomplete="off" />');
                                        f.append(u);
                                        var p;
                                        if (r)
                                            for (p in r) u.attr(p, r[p]);
                                        if (i && e('<a class="' + s.btn + " " + s.clear + '" href="#" />').appendTo(f).on(o.click + "-searchfield", function(e) {
                                                e.preventDefault(), u.val("").trigger(o.keyup + "-searchfield")
                                            }), a) {
                                            for (p in a) f.attr(p, a[p]);
                                            h && !i && e('<a class="' + s.btn + " " + s.next + '" href="#" />').appendTo(f).on(o.click + "-searchfield", function(e) {
                                                e.preventDefault(), f.submit()
                                            })
                                        }
                                        t.hasClass(s.search) ? t.replaceWith(f) : t.prepend(f).addClass(s.hassearch)
                                    }
                                    if (d.noResults) {
                                        var v = t.closest("." + s.panel).length;
                                        if (v || (t = l.$pnls.children("." + s.panel).first()), !t.children("." + s.noresultsmsg).length) {
                                            var m = t.children("." + s.listview).first(),
                                                b = e('<div class="' + s.noresultsmsg + " " + s.hidden + '" />');
                                            b.append(e[n].i18n(d.noResults))[m.length ? "insertAfter" : "prependTo"](m.length ? m : t)
                                        }
                                    }
                                }
                            }), d.search) {
                            if (d.resultsPanel.add) {
                                d.showSubPanels = !1;
                                var f = this.$pnls.children("." + s.resultspanel);
                                f.length || (f = e('<div class="' + s.resultspanel + " " + s.noanimation + " " + s.hidden + '" />').appendTo(this.$pnls).append('<div class="' + s.navbar + " " + s.hidden + '"><a class="' + s.title + '">' + e[n].i18n(d.resultsPanel.title) + "</a></div>").append('<ul class="' + s.listview + '" />').append(this.$pnls.find("." + s.noresultsmsg).first().clone()), this._initPanel(f))
                            }
                            this.$menu.find("." + s.search).each(function() {
                                var n, r, c = e(this),
                                    h = c.closest("." + s.panel).length;
                                h ? (n = c.closest("." + s.panel), r = n) : (n = l.$pnls.find("." + s.panel), r = l.$menu), d.resultsPanel.add && (n = n.not(f));
                                var u = c.children("input"),
                                    p = l.__findAddBack(n, "." + s.listview).children("li"),
                                    v = p.filter("." + s.divider),
                                    m = l.__filterListItems(p),
                                    b = "a",
                                    g = b + ", span",
                                    _ = "",
                                    y = function() {
                                        var t = u.val().toLowerCase();
                                        if (t != _) {
                                            if (_ = t, d.resultsPanel.add && f.children("." + s.listview).empty(), n.scrollTop(0), m.add(v).addClass(s.hidden).find("." + s.fullsubopensearch).removeClass(s.fullsubopen + " " + s.fullsubopensearch), m.each(function() {
                                                    var t = e(this),
                                                        n = b;
                                                    (d.showTextItems || d.showSubPanels && t.find("." + s.next)) && (n = g);
                                                    var i = t.data(a.searchtext) || t.children(n).not("." + s.next).text();
                                                    i.toLowerCase().indexOf(_) > -1 && t.add(t.prevAll("." + s.divider).first()).removeClass(s.hidden)
                                                }), d.showSubPanels && n.each(function(t) {
                                                    var n = e(this);
                                                    l.__filterListItems(n.find("." + s.listview).children()).each(function() {
                                                        var t = e(this),
                                                            n = t.data(a.child);
                                                        t.removeClass(s.nosubresults), n && n.find("." + s.listview).children().removeClass(s.hidden)
                                                    })
                                                }), d.resultsPanel.add)
                                                if ("" === _) this.closeAllPanels(this.$pnls.children("." + s.subopened).last());
                                                else {
                                                    var i = e();
                                                    n.each(function() {
                                                        var t = l.__filterListItems(e(this).find("." + s.listview).children()).not("." + s.hidden).clone(!0);
                                                        t.length && (d.resultsPanel.dividers && (i = i.add('<li class="' + s.divider + '">' + e(this).children("." + s.navbar).children("." + s.title).text() + "</li>")), t.children("." + s.mm("toggle") + ", ." + s.mm("check")).remove(), i = i.add(t))
                                                    }), i.find("." + s.next).remove(), f.children("." + s.listview).append(i), this.openPanel(f)
                                                } else e(n.get().reverse()).each(function(t) {
                                                var n = e(this),
                                                    i = n.data(a.parent);
                                                i && (l.__filterListItems(n.find("." + s.listview).children()).length ? (i.hasClass(s.hidden) && i.children("." + s.next).not("." + s.fullsubopen).addClass(s.fullsubopen).addClass(s.fullsubopensearch), i.removeClass(s.hidden).removeClass(s.nosubresults).prevAll("." + s.divider).first().removeClass(s.hidden)) : h || ((n.hasClass(s.opened) || n.hasClass(s.subopened)) && setTimeout(function() {
                                                    l.openPanel(i.closest("." + s.panel))
                                                }, (t + 1) * (1.5 * l.conf.openingInterval)), i.addClass(s.nosubresults)))
                                            });
                                            r.find("." + s.noresultsmsg)[m.not("." + s.hidden).length ? "addClass" : "removeClass"](s.hidden), this.trigger("updateListview")
                                        }
                                    };
                                u.off(o.keyup + "-" + i + " " + o.change + "-" + i).on(o.keyup + "-" + i, function(e) {
                                    t(e.keyCode) || y.call(l)
                                }).on(o.change + "-" + i, function(e) {
                                    y.call(l)
                                });
                                var C = c.children("." + s.btn);
                                C.length && u.on(o.keyup + "-" + i, function(e) {
                                    C[u.val().length ? "removeClass" : "addClass"](s.hidden)
                                }), u.trigger(o.keyup + "-" + i)
                            })
                        }
                    }
                })
            },
            add: function() {
                s = e[n]._c, a = e[n]._d, o = e[n]._e, s.add("clear search hassearch resultspanel noresultsmsg noresults nosubresults fullsubopensearch"), a.add("searchtext"), o.add("change keyup")
            },
            clickAnchor: function(e, t) {}
        }, e[n].defaults[i] = {
            add: !1,
            addTo: "panels",
            placeholder: "Search",
            noResults: "No results found.",
            resultsPanel: {
                add: !1,
                dividers: !0,
                title: "Search results"
            },
            search: !0,
            showTextItems: !1,
            showSubPanels: !0
        }, e[n].configuration[i] = {
            clear: !1,
            form: !1,
            input: !1,
            submit: !1
        };
        var s, a, o, r
    }(jQuery),
    /*
     * jQuery mmenu sectionIndexer add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "sectionIndexer";
        e[t].addons[n] = {
            setup: function() {
                var s = this,
                    r = this.opts[n];
                this.conf[n];
                o = e[t].glbl, "boolean" == typeof r && (r = {
                    add: r
                }), "object" != typeof r && (r = {}), r = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], r), this.bind("initPanels:after", function(t) {
                    if (r.add) {
                        var o;
                        switch (r.addTo) {
                            case "panels":
                                o = t;
                                break;
                            default:
                                o = e(r.addTo, this.$menu).filter("." + i.panel)
                        }
                        o.find("." + i.divider).closest("." + i.panel).addClass(i.hasindexer), this.$indexer || (this.$indexer = e('<div class="' + i.indexer + '" />').prependTo(this.$pnls).append('<a href="#a">a</a><a href="#b">b</a><a href="#c">c</a><a href="#d">d</a><a href="#e">e</a><a href="#f">f</a><a href="#g">g</a><a href="#h">h</a><a href="#i">i</a><a href="#j">j</a><a href="#k">k</a><a href="#l">l</a><a href="#m">m</a><a href="#n">n</a><a href="#o">o</a><a href="#p">p</a><a href="#q">q</a><a href="#r">r</a><a href="#s">s</a><a href="#t">t</a><a href="#u">u</a><a href="#v">v</a><a href="#w">w</a><a href="#x">x</a><a href="#y">y</a><a href="#z">z</a>'), this.$indexer.children().on(a.mouseover + "-" + n + " " + a.touchstart + "-" + n, function(t) {
                            var n = e(this).attr("href").slice(1),
                                a = s.$pnls.children("." + i.opened),
                                o = a.find("." + i.listview),
                                r = -1,
                                l = a.scrollTop();
                            a.scrollTop(0), o.children("." + i.divider).not("." + i.hidden).each(function() {
                                r < 0 && n == e(this).text().slice(0, 1).toLowerCase() && (r = e(this).position().top)
                            }), a.scrollTop(r > -1 ? r : l)
                        }));
                        var l = function(e) {
                            e = e || this.$pnls.children("." + i.opened), this.$menu[(e.hasClass(i.hasindexer) ? "add" : "remove") + "Class"](i.hasindexer)
                        };
                        this.bind("openPanel:start", l), this.bind("initPanels:after", l)
                    }
                })
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("indexer hasindexer"), a.add("mouseover")
            },
            clickAnchor: function(e, t) {
                if (e.parent().is("." + i.indexer)) return !0
            }
        }, e[t].defaults[n] = {
            add: !1,
            addTo: "panels"
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu setSelected add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "setSelected";
        e[t].addons[n] = {
            setup: function() {
                var a = this,
                    r = this.opts[n];
                this.conf[n];
                if (o = e[t].glbl, "boolean" == typeof r && (r = {
                        hover: r,
                        parent: r
                    }), "object" != typeof r && (r = {}), r = this.opts[n] = e.extend(!0, {}, e[t].defaults[n], r), "detect" == r.current) {
                    var l = function(e) {
                        e = e.split("?")[0].split("#")[0];
                        var t = a.$menu.find('a[href="' + e + '"], a[href="' + e + '/"]');
                        t.length ? a.setSelected(t.parent(), !0) : (e = e.split("/").slice(0, -1), e.length && l(e.join("/")))
                    };
                    this.bind("initMenu:after", function() {
                        l(window.location.href)
                    })
                } else r.current || this.bind("initListview:after", function(e) {
                    this.$pnls.find("." + i.listview).children("." + i.selected).removeClass(i.selected)
                });
                r.hover && this.bind("initMenu:after", function() {
                    this.$menu.addClass(i.hoverselected)
                }), r.parent && (this.bind("openPanel:finish", function(e) {
                    this.$pnls.find("." + i.listview).find("." + i.next).removeClass(i.selected);
                    for (var t = e.data(s.parent); t;) t.not("." + i.vertical).children("." + i.next).addClass(i.selected), t = t.closest("." + i.panel).data(s.parent)
                }), this.bind("initMenu:after", function() {
                    this.$menu.addClass(i.parentselected)
                }))
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("hoverselected parentselected")
            },
            clickAnchor: function(e, t) {}
        }, e[t].defaults[n] = {
            current: !0,
            hover: !1,
            parent: !1
        };
        var i, s, a, o
    }(jQuery),
    /*
     * jQuery mmenu toggles add-on
     * mmenu.frebsite.nl
     *
     * Copyright (c) Fred Heusschen
     */
    function(e) {
        var t = "mmenu",
            n = "toggles";
        e[t].addons[n] = {
            setup: function() {
                var s = this;
                this.opts[n], this.conf[n];
                o = e[t].glbl, this.bind("initListview:after", function(t) {
                    this.__refactorClass(t.find("input"), this.conf.classNames[n].toggle, "toggle"), this.__refactorClass(t.find("input"), this.conf.classNames[n].check, "check"), t.find("input." + i.toggle + ", input." + i.check).each(function() {
                        var t = e(this),
                            n = t.closest("li"),
                            a = t.hasClass(i.toggle) ? "toggle" : "check",
                            o = t.attr("id") || s.__getUniqueId();
                        n.children('label[for="' + o + '"]').length || (t.attr("id", o), n.prepend(t), e('<label for="' + o + '" class="' + i[a] + '"></label>').insertBefore(n.children("a, span").last()))
                    })
                })
            },
            add: function() {
                i = e[t]._c, s = e[t]._d, a = e[t]._e, i.add("toggle check")
            },
            clickAnchor: function(e, t) {}
        }, e[t].configuration.classNames[n] = {
            toggle: "Toggle",
            check: "Check"
        };
        var i, s, a, o
    }(jQuery);
    return true;
}));


