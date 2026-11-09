/**
 * The value of an element's `data-dx-inspectable`, or null when it is absent, empty or
 * `"false"`. Any other value marks the element as a whole target: `"true"` says nothing
 * more, and anything else (`"promo card"`) is also its name in “Copy all”.
 */
export const readInspectableHint = (element: HTMLElement): string | null => {
  const value = element.dataset.dxInspectable?.trim()
  return value && value !== 'false' ? value : null
}
