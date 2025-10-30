'use client'

import { Drawing } from '@/lib/canvas-utils'
import PlanCanvasEfficient from './plan-canvas-efficient'

export interface Viewport {
	zoom: number
	panX: number
	panY: number
}

interface PlanCanvasProps {
	pdfImages: HTMLCanvasElement[]
	drawings: Drawing[]
	onDrawingsChange: (drawings: Drawing[]) => void
	rightSidebarOpen: boolean
	onRightSidebarToggle: () => void
	onCommentPinClick: (x: number, y: number, pageNumber: number) => void
	pdfUrl?: string
}

export default function PlanCanvas({
	pdfImages,
	drawings,
	onDrawingsChange,
	rightSidebarOpen,
	onRightSidebarToggle,
	onCommentPinClick,
	pdfUrl
}: PlanCanvasProps) {
	return (
		<PlanCanvasEfficient
			pdfImages={pdfImages}
			drawings={drawings}
			onDrawingsChange={onDrawingsChange}
			rightSidebarOpen={rightSidebarOpen}
			onRightSidebarToggle={onRightSidebarToggle}
			onCommentPinClick={onCommentPinClick}
			pdfUrl={pdfUrl}
		/>
	)
}
