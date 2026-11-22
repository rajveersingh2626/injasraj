import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, BookOpen, Loader2, History, Trash2 } from 'lucide-react';
import { GlassCard } from '../../ui/GlassCard';
import { GlassButton } from '../../ui/GlassButton';
import { PastClassRecord } from '@/lib/classroom/past-classes';

export interface WorksheetMaterial {
  id: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  pageCount?: number;
}

export interface MaterialsTabProps {
  onLoadWorksheet: (fileOrUrl: File | string) => void;
  worksheets?: WorksheetMaterial[];
  isLoading?: boolean;
  pastClasses?: PastClassRecord[];
  onRestoreWhiteboard?: (pastClass: PastClassRecord) => void;
  isTeacher?: boolean;
  className?: string;
}

export const ALGEBRA_WORKSHEET_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#f8fafc"/>
  
  <!-- Header Banner -->
  <rect x="60" y="40" width="1800" height="90" rx="16" fill="#1e293b"/>
  <text x="100" y="98" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Algebra 1: Quadratic Equations Practice</text>
  <text x="1340" y="98" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="#94a3b8">Standard Form: ax² + bx + c = 0</text>

  <!-- Formula Box -->
  <rect x="60" y="160" width="860" height="230" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="160" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">KEY QUADRATIC FORMULAS &amp; PROPERTIES</text>
  <text x="80" y="235" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">• Quadratic Formula: x = (-b ± √(b² - 4ac)) / (2a)</text>
  <text x="80" y="275" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="#334155">• Discriminant: Δ = b² - 4ac  (Δ &gt; 0: 2 real roots, Δ = 0: 1 double root, Δ &lt; 0: 2 complex)</text>
  <text x="80" y="315" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="#334155">• Vertex Form: y = a(x - h)² + k where Vertex = (h, k), Axis of Symmetry: x = -b/(2a)</text>
  <text x="80" y="355" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="#334155">• Factored Form: y = a(x - r₁)(x - r₂) with roots at x = r₁, r₂</text>

  <!-- Coordinate Grid & Graph Section -->
  <rect x="960" y="160" width="900" height="420" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="160" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">COORDINATE GRAPH: f(x) = x² - 4x</text>
  
  <!-- Coordinate Axes & Grid -->
  <g transform="translate(1360, 390)">
    <!-- Grid lines -->
    <path d="M-350,-180 h700 M-350,-120 h700 M-350,-60 h700 M-350,60 h700 M-350,120 h700" stroke="#f1f5f9" stroke-width="1.5"/>
    <path d="M-300,-200 v340 M-200,-200 v340 M-100,-200 v340 M100,-200 v340 M200,-200 v340 M300,-200 v340" stroke="#f1f5f9" stroke-width="1.5"/>
    <!-- Axes -->
    <line x1="-350" y1="0" x2="350" y2="0" stroke="#64748b" stroke-width="2.5"/>
    <line x1="0" y1="-200" x2="0" y2="140" stroke="#64748b" stroke-width="2.5"/>
    <text x="360" y="6" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#475569">x</text>
    <text x="-6" y="-210" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#475569">y</text>
    <!-- Parabolic Curve y = x² - 4x -->
    <path d="M-60,-120 Q100,240 260,-120" stroke="#3b82f6" stroke-width="3.5" fill="none"/>
    <circle cx="100" cy="80" r="6" fill="#ef4444"/>
    <text x="115" y="86" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600" fill="#ef4444">Vertex (2, -4)</text>
    <circle cx="0" cy="0" r="5" fill="#10b981"/>
    <text x="-60" y="-12" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#10b981">Root (0, 0)</text>
    <circle cx="200" cy="0" r="5" fill="#10b981"/>
    <text x="210" y="-12" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#10b981">Root (4, 0)</text>
    <!-- Axis of symmetry -->
    <line x1="100" y1="-190" x2="100" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text x="110" y="-170" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">Axis x = 2</text>
  </g>

  <!-- Exercises 1 & 2 -->
  <rect x="60" y="420" width="860" height="600" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="420" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="450" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">EXERCISES 1 &amp; 2: FACTORING &amp; VERTEX</text>
  
  <text x="80" y="495" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 1: Solve by Factoring</text>
  <text x="80" y="530" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Given the equation:  x² - 6x + 8 = 0</text>
  <text x="80" y="565" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Find two numbers that multiply to +8 and add to -6.</text>
  <text x="80" y="600" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Express in factored form: (x - ____)(x - ____) = 0</text>
  <text x="80" y="635" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">c) State the final solutions: x₁ = ________,  x₂ = ________</text>
  <rect x="80" y="660" width="820" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="695" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard working space for Exercise 1...</text>

  <line x1="80" y1="745" x2="900" y2="745" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="80" y="785" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 2: Finding Vertex &amp; Transformations</text>
  <text x="80" y="820" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Consider the quadratic function:  f(x) = 2x² - 8x + 6</text>
  <text x="80" y="855" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Calculate the axis of symmetry: x = -b / (2a) = ____________</text>
  <text x="80" y="890" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Evaluate f(x) at the axis of symmetry to find the vertex (h, k): ____________</text>
  <text x="80" y="925" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">c) Does the parabola open upwards or downwards? State the minimum value.</text>
  <rect x="80" y="945" width="820" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="980" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard working space for Exercise 2...</text>

  <!-- Exercise 3 -->
  <rect x="960" y="610" width="900" height="410" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="610" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="640" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">EXERCISE 3: QUADRATIC FORMULA APPLICATION</text>
  <text x="980" y="690" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 3: Solve with Quadratic Formula</text>
  <text x="980" y="725" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Solve:  3x² + 5x - 2 = 0</text>
  <text x="980" y="765" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Step 1: Identify coefficients: a = ____, b = ____, c = ____</text>
  <text x="980" y="800" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Step 2: Calculate Discriminant Δ = b² - 4ac = (____)² - 4(____)(____) = ____</text>
  <text x="980" y="835" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Step 3: Apply x = (-b ± √Δ) / 2a = (_____ ± _____) / _____</text>
  <text x="980" y="870" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Step 4: Solutions: x₁ = ________,  x₂ = ________</text>
  <rect x="980" y="895" width="860" height="105" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="1000" y="950" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard calculation &amp; verification space...</text>
</svg>`
  )
}`;

export const PHYSICS_WORKSHEET_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#f8fafc"/>
  
  <!-- Header Banner -->
  <rect x="60" y="40" width="1800" height="90" rx="16" fill="#0f172a"/>
  <text x="100" y="98" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Physics: Kinematics &amp; Motion Graphs</text>
  <text x="1340" y="98" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="#38bdf8">1D Constant Acceleration Models</text>

  <!-- Kinematics Formula Box -->
  <rect x="60" y="160" width="860" height="230" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="160" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">CORE KINEMATICS EQUATIONS (CONSTANT a)</text>
  <text x="80" y="235" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">1. Velocity-Time:  v = v₀ + at</text>
  <text x="80" y="275" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">2. Displacement-Time:  Δx = v₀t + ½at²</text>
  <text x="80" y="315" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">3. Timeless Equation:  v² = v₀² + 2aΔx</text>
  <text x="80" y="355" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="#334155">4. Average Velocity:  Δx = ½(v₀ + v)t  |  Free Fall: a = -g = -9.8 m/s²</text>

  <!-- Velocity-Time Graph -->
  <rect x="960" y="160" width="900" height="420" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="160" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">VELOCITY-TIME (v-t) MOTION GRAPH</text>

  <!-- Graph elements -->
  <g transform="translate(1040, 520)">
    <!-- Shaded area for displacement (t=0..12) -->
    <polygon points="0,0 200,-200 400,-200 600,0" fill="#e0f2fe" opacity="0.8"/>
    
    <!-- Grid lines -->
    <path d="M0,-50 h650 M0,-100 h650 M0,-150 h650 M0,-200 h650 M0,-250 h650" stroke="#f1f5f9" stroke-width="1.5"/>
    <path d="M100,-270 v270 M200,-270 v270 M300,-270 v270 M400,-270 v270 M500,-270 v270 M600,-270 v270" stroke="#f1f5f9" stroke-width="1.5"/>
    
    <!-- Axes -->
    <line x1="0" y1="0" x2="680" y2="0" stroke="#334155" stroke-width="2.5"/>
    <line x1="0" y1="10" x2="0" y2="-280" stroke="#334155" stroke-width="2.5"/>
    <text x="690" y="5" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600" fill="#475569">t (s)</text>
    <text x="-40" y="-285" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600" fill="#475569">v (m/s)</text>

    <!-- Ticks & labels -->
    <text x="-25" y="-95" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">10</text>
    <text x="-25" y="-195" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">20</text>
    <text x="195" y="24" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">4</text>
    <text x="395" y="24" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">8</text>
    <text x="595" y="24" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748b">12</text>

    <!-- Graph curve -->
    <line x1="0" y1="0" x2="200" y2="-200" stroke="#0284c7" stroke-width="3.5"/>
    <line x1="200" y1="-200" x2="400" y2="-200" stroke="#0284c7" stroke-width="3.5"/>
    <line x1="400" y1="-200" x2="600" y2="0" stroke="#0284c7" stroke-width="3.5"/>

    <!-- Key points -->
    <circle cx="200" cy="-200" r="5" fill="#0369a1"/>
    <circle cx="400" cy="-200" r="5" fill="#0369a1"/>
    <text x="80" y="-120" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#0284c7">a = +5 m/s²</text>
    <text x="260" y="-215" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#0284c7">Constant 20 m/s</text>
    <text x="480" y="-120" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#ef4444">a = -5 m/s²</text>
    <text x="270" y="-80" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600" fill="#0369a1">Area = Δx (Displacement)</text>
  </g>

  <!-- Problem 1 & 2 -->
  <rect x="60" y="420" width="860" height="600" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="420" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="450" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">PROBLEMS 1 &amp; 2: ACCELERATION &amp; GRAPH ANALYSIS</text>

  <text x="80" y="495" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Problem 1: Uniform Acceleration from Rest</text>
  <text x="80" y="530" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">A vehicle accelerates uniformly from rest at a = 3.5 m/s² for t = 6.0 s.</text>
  <text x="80" y="565" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Compute the vehicle's final velocity: v = v₀ + at = ____________ m/s</text>
  <text x="80" y="600" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Calculate total distance traveled: Δx = v₀t + ½at² = ____________ m</text>
  <rect x="80" y="625" width="820" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="665" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard work space for Problem 1...</text>

  <line x1="80" y1="725" x2="900" y2="725" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="80" y="765" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Problem 2: Velocity-Time Graph Integration</text>
  <text x="80" y="800" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Refer to the v-t graph to the right (t = 0 to 12 s):</text>
  <text x="80" y="835" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Area of section 1 (triangle t=0..4s): Area₁ = ½(4)(20) = ______ m</text>
  <text x="80" y="870" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Area of section 2 (rectangle t=4..8s): Area₂ = (4)(20) = ______ m</text>
  <text x="80" y="905" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">c) Total displacement: Δx_total = Area₁ + Area₂ + Area₃ = ______ m</text>
  <rect x="80" y="930" width="820" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="970" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard work space for Problem 2...</text>

  <!-- Problem 3 -->
  <rect x="960" y="610" width="900" height="410" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="610" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="640" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">PROBLEM 3: VERTICAL FREE-FALL UNDER GRAVITY</text>
  <text x="980" y="690" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Problem 3: Projectile Motion</text>
  <text x="980" y="725" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">A tennis ball is projected vertically upward at v₀ = 19.6 m/s (g = 9.8 m/s²):</text>
  <text x="980" y="765" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Time to reach apex (v = 0):  0 = v₀ - gt  ⇒  t_apex = ________ s</text>
  <text x="980" y="800" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Maximum height reached:  v² = v₀² - 2g(h_max)  ⇒  h_max = ________ m</text>
  <text x="980" y="835" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">c) Total time aloft until returning to origin: t_total = ________ s</text>
  <rect x="980" y="865" width="860" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="1000" y="930" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard calculation &amp; vector free-body diagram area...</text>
</svg>`
  )
}`;

export const CALCULUS_WORKSHEET_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#f8fafc"/>
  
  <!-- Header Banner -->
  <rect x="60" y="40" width="1800" height="90" rx="16" fill="#1e1b4b"/>
  <text x="100" y="98" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Calculus: Derivatives &amp; Rates of Change</text>
  <text x="1340" y="98" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="#a5b4fc">Differential Calculus Practice</text>

  <!-- Derivative Rules Box -->
  <rect x="60" y="160" width="860" height="230" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="160" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">FUNDAMENTAL DIFFERENTIATION RULES</text>
  <text x="80" y="235" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">• Power Rule:  d/dx [xⁿ] = n · xⁿ⁻¹</text>
  <text x="80" y="275" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">• Product Rule:  (u · v)' = u'v + uv'</text>
  <text x="80" y="315" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#0f172a">• Quotient Rule:  (u / v)' = (u'v - uv') / v²</text>
  <text x="80" y="355" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="#334155">• Chain Rule:  d/dx [f(g(x))] = f'(g(x)) · g'(x)</text>

  <!-- Tangent Line & Slope Curve Visual -->
  <rect x="960" y="160" width="900" height="420" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="160" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="190" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">TANGENT LINE TO f(x) AT POINT P(x₀, y₀)</text>

  <g transform="translate(1360, 400)">
    <!-- Axes -->
    <line x1="-350" y1="0" x2="350" y2="0" stroke="#64748b" stroke-width="2.5"/>
    <line x1="0" y1="-200" x2="0" y2="130" stroke="#64748b" stroke-width="2.5"/>
    <text x="360" y="6" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#475569">x</text>
    <text x="-6" y="-210" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#475569">y</text>

    <!-- Curve y = x² - 4x + 3 -->
    <path d="M0, -150 Q100, 150 200, -150" stroke="#7c3aed" stroke-width="3.5" fill="none"/>
    <text x="210" y="-140" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600" fill="#7c3aed">f(x) = x² - 4x + 3</text>

    <!-- Tangent line through (150, 0) with slope 2 -->
    <line x1="50" y1="100" x2="220" y2="-140" stroke="#f43f5e" stroke-width="3" stroke-dasharray="8,4"/>
    <circle cx="150" cy="0" r="6" fill="#f43f5e"/>
    <text x="165" y="25" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="700" fill="#f43f5e">P(3, 0), Slope m = f'(3) = 2</text>
    <text x="70" y="125" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#f43f5e">Tangent: y = 2x - 6</text>
  </g>

  <!-- Exercises 1 & 2 -->
  <rect x="60" y="420" width="860" height="600" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="60" y="420" width="860" height="44" rx="12" fill="#e2e8f0"/>
  <text x="80" y="450" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">EXERCISES 1 &amp; 2: POWER RULE &amp; TANGENT LINES</text>

  <text x="80" y="495" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 1: Power &amp; Polynomial Derivatives</text>
  <text x="80" y="530" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Let  f(x) = 4x⁵ - 3x³ + 7x - 9</text>
  <text x="80" y="565" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Compute the first derivative: f'(x) = ________________________</text>
  <text x="80" y="600" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Evaluate the rate of change at x = 1: f'(1) = ____________</text>
  <rect x="80" y="625" width="820" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="665" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard work space for Exercise 1...</text>

  <line x1="80" y1="725" x2="900" y2="725" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="80" y="765" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 2: Equation of the Tangent Line</text>
  <text x="80" y="800" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">For curve  y = x² - 4x + 3  at point P(3, 0):</text>
  <text x="80" y="835" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">a) Find dy/dx:  y' = 2x - 4</text>
  <text x="80" y="870" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">b) Evaluate slope m = y'(3) = 2(3) - 4 = ______</text>
  <text x="80" y="905" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">c) Use point-slope form: y - y₀ = m(x - x₀)  ⇒  y = ____________</text>
  <rect x="80" y="930" width="820" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="100" y="970" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard work space for Exercise 2...</text>

  <!-- Exercise 3 -->
  <rect x="960" y="610" width="900" height="410" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="960" y="610" width="900" height="44" rx="12" fill="#e2e8f0"/>
  <text x="980" y="640" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#334155">EXERCISE 3: PRODUCT RULE &amp; EXPANSION</text>
  <text x="980" y="690" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#1e293b">Exercise 3: Product Rule Verification</text>
  <text x="980" y="725" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#334155">Let  g(t) = (3t² + 1)(2t - 5)</text>
  <text x="980" y="765" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Method A (Product Rule): u = 3t²+1, v = 2t-5  ⇒  u' = 6t, v' = 2</text>
  <text x="980" y="800" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">g'(t) = (6t)(2t - 5) + (3t² + 1)(2) = ________________________</text>
  <text x="980" y="835" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#64748b">Method B: Expand g(t) = 6t³ - 15t² + 2t - 5 and differentiate directly.</text>
  <rect x="980" y="865" width="860" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-dasharray="4,4"/>
  <text x="1000" y="930" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#94a3b8">Whiteboard comparison and verification space...</text>
</svg>`
  )
}`;

export const DEFAULT_WORKSHEETS: WorksheetMaterial[] = [
  {
    id: 'algebra-quadratics',
    title: 'Algebra 1: Quadratic Equations Practice',
    description: 'Factoring, quadratic formula, and vertex form exercises',
    url: ALGEBRA_WORKSHEET_SVG,
    category: 'Mathematics',
    pageCount: 3,
  },
  {
    id: 'physics-kinematics',
    title: 'Physics: Kinematics & Motion Graphs',
    description: 'Velocity-time graphs and uniform acceleration problems',
    url: PHYSICS_WORKSHEET_SVG,
    category: 'Physics',
    pageCount: 4,
  },
  {
    id: 'calculus-derivatives',
    title: 'Calculus: Derivatives & Rates of Change',
    description: 'Product, quotient, and chain rule guided problem set',
    url: CALCULUS_WORKSHEET_SVG,
    category: 'Calculus',
    pageCount: 5,
  },
];

export const MaterialsTab: React.FC<MaterialsTabProps> = ({
  onLoadWorksheet,
  worksheets,
  isLoading = false,
  pastClasses = [],
  onRestoreWhiteboard,
  isTeacher = true,
  className = '',
}) => {
  const [activeWorksheets, setActiveWorksheets] = useState<WorksheetMaterial[]>(
    () => worksheets ?? DEFAULT_WORKSHEETS
  );

  useEffect(() => {
    if (worksheets) {
      setActiveWorksheets(worksheets);
    }
  }, [worksheets]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onLoadWorksheet(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSelectedFile = () => {
    if (selectedFile) {
      onLoadWorksheet(selectedFile);
    }
  };

  return (
    <div
      data-testid="materials-tab"
      className={`flex flex-col h-full gap-4 p-4 overflow-y-auto select-none ${className}`}
    >
      {/* Upload PDF Section */}
      <section
        data-testid="pdf-upload-section"
        aria-label="Upload PDF Worksheet"
        className="flex flex-col gap-2.5 pb-4 border-b border-stone-800"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-400">
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          <span>Upload Lesson Material</span>
        </div>

        <GlassCard
          variant="subtle"
          className="flex flex-col items-center justify-center p-4 border border-dashed border-stone-700 rounded-xl text-center gap-3 bg-stone-900/60"
        >
          {/* Hidden HTML File Input for PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            data-testid="pdf-file-input"
            aria-label="Upload PDF Worksheet"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-stone-200">
              {selectedFile ? selectedFile.name : 'Upload PDF Worksheet'}
            </span>
            <span className="text-[11px] text-stone-400">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : 'Supports multi-page vector PDF or WebP/PNG images'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              variant="default"
              size="sm"
              data-testid="upload-pdf-trigger-btn"
              onClick={handleUploadClick}
              disabled={isLoading}
              className="text-xs border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {selectedFile ? 'Change PDF' : 'Choose PDF File'}
            </GlassButton>

            {selectedFile && (
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                data-testid="load-pdf-button"
                onClick={handleLoadSelectedFile}
                disabled={isLoading}
                className="text-xs bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                Load into Whiteboard
              </GlassButton>
            )}
          </div>
        </GlassCard>
      </section>

      {/* Worksheet Library */}
      <section
        data-testid="worksheet-library-section"
        aria-label="Worksheet Library"
        className="flex flex-col gap-3 flex-1"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-stone-400 tracking-wider uppercase">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sample Worksheets ({activeWorksheets.length})</span>
          </div>
          {isLoading && (
            <div data-testid="materials-loading" className="flex items-center gap-1 text-amber-400 text-[10px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        {activeWorksheets.length === 0 ? (
          <div
            data-testid="empty-worksheets-state"
            className="p-4 rounded-xl border border-stone-800 bg-stone-900/40 text-center"
          >
            <p className="text-xs text-stone-400">
              No extra worksheets uploaded yet. Use the upload box above to load PDFs or images directly onto your whiteboard.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" data-testid="worksheets-list">
            {activeWorksheets.map((item) => (
              <GlassCard
                key={item.id}
                variant="default"
                data-testid={`worksheet-card-${item.id}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-stone-800 bg-stone-900/90 text-stone-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {item.category && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          {item.category}
                        </span>
                      )}
                      {item.pageCount && (
                        <span className="text-[10px] text-stone-400">
                          {item.pageCount} pages
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-stone-100 mt-1 truncate">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid={`delete-worksheet-${item.id}`}
                    aria-label={`Delete worksheet ${item.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveWorksheets((prev) => prev.filter((w) => w.id !== item.id));
                    }}
                    className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Delete this sample worksheet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid={`load-worksheet-${item.id}`}
                    data-load-worksheet-id={item.id}
                    onClick={() => onLoadWorksheet(item.url)}
                    disabled={isLoading}
                    className="w-full text-xs py-1.5 bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Load into Whiteboard
                  </GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Past Whiteboards History */}
      {isTeacher && pastClasses && pastClasses.length > 0 && (
        <section
          data-testid="past-whiteboards-section"
          aria-label="Past Whiteboards History"
          className="flex flex-col gap-2.5 pt-3 border-t border-stone-800"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-400">
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Past Whiteboards ({pastClasses.length})</span>
          </div>

          <div className="flex flex-col gap-2" data-testid="past-whiteboards-list">
            {pastClasses.map((item) => (
              <GlassCard
                key={item.id}
                variant="default"
                data-testid={`past-whiteboard-card-${item.roomId}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-stone-800 bg-stone-900/90 text-stone-100"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-stone-400 font-mono">
                      {item.roomId}
                    </span>
                    <h4 className="text-xs font-semibold text-stone-100 truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-amber-400/80">
                      {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} • {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid={`restore-past-wb-${item.roomId}`}
                    onClick={() => onRestoreWhiteboard?.(item)}
                    className="w-full text-xs py-1 bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold"
                  >
                    <History className="w-3.5 h-3.5 mr-1" />
                    Restore Whiteboard
                  </GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MaterialsTab;
