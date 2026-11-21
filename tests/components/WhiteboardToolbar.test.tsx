import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WhiteboardToolbar } from '../../src/components/whiteboard/WhiteboardToolbar';
import { WhiteboardToolType } from '../../src/types/whiteboard';

expect.extend({
  toBeInTheDocument(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      (received.ownerDocument?.body.contains(received) ?? false);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be in document`,
    };
  },
  toHaveClass(received, className) {
    const pass = Boolean(
      received?.classList?.contains(className) ||
        (received?.className && received.className.includes(className))
    );
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}have class ${className}`,
    };
  },
  toBeDisabled(received) {
    const pass = Boolean(received?.disabled || received?.hasAttribute('disabled'));
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be disabled`,
    };
  },
});

describe('WhiteboardToolbar Component (Floating Glass Tool Dock)', () => {
  const defaultProps = {
    activeTool: 'pen' as WhiteboardToolType,
    onSelectTool: vi.fn(),
    strokeProperties: { color: '#ffffff', width: 4 },
    onChangeStrokeProperties: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClearPage: vi.fn(),
  };

  it('renders all standard tools and shows active state styling on current tool', () => {
    render(<WhiteboardToolbar {...defaultProps} activeTool="pen" />);

    const penBtn = screen.getByTestId('tool-pen');
    expect(penBtn).toBeInTheDocument();
    expect(penBtn.getAttribute('data-active')).toBe('true');
    expect(penBtn).toHaveClass('bg-white/20');

    const selectBtn = screen.getByTestId('tool-select');
    expect(selectBtn).toBeInTheDocument();
    expect(selectBtn.getAttribute('data-active')).toBe('false');
  });

  it('invokes onSelectTool when standard tools are clicked', () => {
    const handleSelectTool = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onSelectTool={handleSelectTool} />);

    // Select Tool
    fireEvent.click(screen.getByTestId('tool-select'));
    expect(handleSelectTool).toHaveBeenCalledWith('select');

    // Pan Tool
    fireEvent.click(screen.getByTestId('tool-pan'));
    expect(handleSelectTool).toHaveBeenCalledWith('pan');

    // Highlighter Tool
    fireEvent.click(screen.getByTestId('tool-highlighter'));
    expect(handleSelectTool).toHaveBeenCalledWith('highlighter');

    // Text Tool
    fireEvent.click(screen.getByTestId('tool-text'));
    expect(handleSelectTool).toHaveBeenCalledWith('text');

    // Sticky Note Tool
    fireEvent.click(screen.getByTestId('tool-sticky'));
    expect(handleSelectTool).toHaveBeenCalledWith('sticky');

    // Laser Pointer Tool
    fireEvent.click(screen.getByTestId('tool-laser'));
    expect(handleSelectTool).toHaveBeenCalledWith('laser');
  });

  it('opens shapes menu and selects geometric shapes', () => {
    const handleSelectTool = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onSelectTool={handleSelectTool} />);

    const shapesBtn = screen.getByTestId('tool-shapes');
    expect(screen.queryByTestId('shapes-menu')).toBeNull();

    // Open Shapes Menu
    fireEvent.click(shapesBtn);
    expect(screen.getByTestId('shapes-menu')).toBeInTheDocument();

    // Select Rectangle
    const rectBtn = screen.getByTestId('tool-rect');
    fireEvent.click(rectBtn);
    expect(handleSelectTool).toHaveBeenCalledWith('rect');

    // Shapes menu should close after selection
    expect(screen.queryByTestId('shapes-menu')).toBeNull();
  });

  it('marks shapes button as active when activeTool is a shape', () => {
    render(<WhiteboardToolbar {...defaultProps} activeTool="circle" />);

    const shapesBtn = screen.getByTestId('tool-shapes');
    expect(shapesBtn.getAttribute('data-active')).toBe('true');
    expect(shapesBtn).toHaveClass('bg-white/20');
  });

  it('opens color/stroke popover and triggers stroke property changes', () => {
    const handleChangeStroke = vi.fn();
    render(
      <WhiteboardToolbar
        {...defaultProps}
        strokeProperties={{ color: '#3b82f6', width: 4 }}
        onChangeStrokeProperties={handleChangeStroke}
      />
    );

    const colorDot = screen.getByTestId('color-indicator-dot');
    expect(colorDot.style.backgroundColor).toBe('rgb(59, 130, 246)');

    const colorBtn = screen.getByTestId('color-indicator-btn');
    expect(screen.queryByTestId('color-stroke-popover')).toBeNull();

    // Open popover
    fireEvent.click(colorBtn);
    expect(screen.getByTestId('color-stroke-popover')).toBeInTheDocument();

    // Click Red swatch
    const redSwatch = screen.getByTestId('color-swatch-ef4444');
    fireEvent.click(redSwatch);
    expect(handleChangeStroke).toHaveBeenCalledWith({ color: '#ef4444' });

    // Click 8px stroke width
    const stroke8Btn = screen.getByTestId('stroke-width-8');
    fireEvent.click(stroke8Btn);
    expect(handleChangeStroke).toHaveBeenCalledWith({ width: 8 });
  });

  it('handles undo and redo callbacks and honors canUndo/canRedo disabled states', () => {
    const handleUndo = vi.fn();
    const handleRedo = vi.fn();

    const { rerender } = render(
      <WhiteboardToolbar
        {...defaultProps}
        canUndo={false}
        canRedo={false}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    );

    const undoBtn = screen.getByTestId('action-undo');
    const redoBtn = screen.getByTestId('action-redo');

    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    fireEvent.click(undoBtn);
    fireEvent.click(redoBtn);
    expect(handleUndo).not.toHaveBeenCalled();
    expect(handleRedo).not.toHaveBeenCalled();

    // Rerender with canUndo = true, canRedo = true
    rerender(
      <WhiteboardToolbar
        {...defaultProps}
        canUndo={true}
        canRedo={true}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    );

    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).not.toBeDisabled();

    fireEvent.click(undoBtn);
    expect(handleUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(redoBtn);
    expect(handleRedo).toHaveBeenCalledTimes(1);
  });

  it('triggers onClearPage when clear page button is clicked', () => {
    const handleClear = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onClearPage={handleClear} />);

    const clearBtn = screen.getByTestId('action-clear');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('disables disallowed tools when allowedTools is specified', () => {
    render(
      <WhiteboardToolbar
        {...defaultProps}
        allowedTools={['select', 'pan', 'laser']}
      />
    );

    const selectBtn = screen.getByTestId('tool-select');
    const laserBtn = screen.getByTestId('tool-laser');
    const penBtn = screen.getByTestId('tool-pen');
    const pencilBtn = screen.getByTestId('tool-pencil');

    expect(selectBtn).not.toBeDisabled();
    expect(laserBtn).not.toBeDisabled();
    expect(penBtn).toBeDisabled();
    expect(pencilBtn).toBeDisabled();
  });
});
