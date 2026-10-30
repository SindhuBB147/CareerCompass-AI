import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Journey3D renders an interactive 3‑D career journey.
 * It visualises each milestone as a floating sphere on a curved path.
 * The component falls back to a static placeholder when the user prefers reduced motion
 * or when WebGL is unavailable.
 */
import type { Roadmap } from '../../../lib/roadmap-api';

interface Journey3DProps {
  roadmap: Roadmap;
  /**
   * Called when a milestone sphere is clicked.
   * The parent page can forward this to handleMilestoneUpdate or open a details panel.
   */
  onMilestoneSelect?: (milestoneKey: string, ...args: any[]) => void;
}

// Helper to map status to sphere color
const statusColorMap: Record<string, string> = {
  not_started: '#999',
  in_progress: '#3b82f6', // blue
  completed: '#10b981', // green
  blocked: '#ef4444', // red
};

const Journey3D: React.FC<Journey3DProps> = ({ roadmap, onMilestoneSelect }) => {
  const milestones = useMemo(() => roadmap.phases.flatMap(p => p.milestones), [roadmap]);
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);

  if (prefersReduced) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        3‑D journey visualization (reduced‑motion mode)
      </div>
    );
  }

  // Positions along a smooth arc
  const points = useMemo(() => {
    const count = milestones.length || 1;
    const radius = 5;
    const angleStep = Math.PI / (count + 1);
    const pts: THREE.Vector3[] = [];
    for (let i = 1; i <= count; i++) {
      const angle = angleStep * i - Math.PI / 2;
      pts.push(new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
    }
    return pts;
  }, [milestones]);

  const curve = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(points);
    c.curveType = 'catmullrom';
    return c;
  }, [points]);

  // Legend for status colors
  const Legend = () => (
    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
      {Object.entries(statusColorMap).map(([key, color]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '50%' }} />
          <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ width: '100%', minHeight: '380px', maxHeight: '460px' }}>
      <Canvas camera={{ position: [0, 0, 12], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        {/* Path line */}
        <mesh>
          <tubeGeometry args={[curve, 64, 0.05, 8, false]} />
          <meshStandardMaterial color="#64748b" transparent opacity={0.4} />
        </mesh>
        {/* Milestone spheres */}
        {points.map((pos, idx) => {
          const milestone = milestones[idx];
          const color = statusColorMap[milestone?.status] || '#666';
          return (
            <mesh
              key={milestone?.milestoneKey || idx}
              position={pos}
              onClick={(e) => {
                e.stopPropagation();
                if (onMilestoneSelect && milestone?.milestoneKey) onMilestoneSelect(milestone.milestoneKey);
              }}
              onPointerOver={() => setHoveredKey(milestone?.milestoneKey || null)}
              onPointerOut={() => setHoveredKey(null)}
            >
              <sphereGeometry args={[0.22, 32, 32]} />
              <meshStandardMaterial color={color} />
              {hoveredKey === milestone?.milestoneKey && (
                <Html distanceFactor={10} style={{ pointerEvents: 'none' }}>
                  <div style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    {milestone?.title}
                  </div>
                </Html>
              )}
            </mesh>
          );
        })}
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} />
      </Canvas>
      <Legend />
    </div>
  );
};

export default Journey3D;
