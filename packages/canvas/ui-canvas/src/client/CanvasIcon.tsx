/** Decorative occupant for the Canvas sidebar entry. */
import { IconLayersOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the layers glyph at the size the sidebar asks for; the sidebar owns
 * its accessible navigation label and selected state.
 * @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
 * @returns decorative layers icon.
 */
export function CanvasIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconLayersOutlineRegular size={size} />
}
