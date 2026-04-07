/**
 * FinBiome Screen
 *
 * A 3D WebGL visualization system using plain Three.js (no React wrapper).
 * Features: FinTree - hierarchical financial trees in a forest layout.
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as THREE from 'three';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import {
  buildForestLayout,
  buildTreeHierarchy,
  buildFlowData,
  buildRiverFlows,
} from '../lib/finbiome/dataTransforms';

function FinBiomeContent() {
  const navigation = useNavigation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const {
    accounts,
    categories,
    transactions,
    selectedAccountId,
    interval,
    inInterval,
  } = useDashboard();

  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(selectedAccountId);

  // Transform data (with defensive checks)
  const forestLayout = useMemo(() => buildForestLayout(accounts), [accounts]);

  const flowData = useMemo(() => {
    if (!inInterval || typeof inInterval !== 'function') {
      return []; // Return empty array if inInterval not ready
    }
    return buildFlowData(transactions, accounts, interval, inInterval);
  }, [transactions, accounts, interval, inInterval]);

  const riverData = useMemo(
    () => buildRiverFlows(accounts, categories, transactions),
    [accounts, categories, transactions]
  );

  // Log transformed data
  useEffect(() => {
    console.log('=== FinBiome Data ===');
    console.log('Forest Layout:', forestLayout);
    console.log('Flow Data:', flowData);
    console.log('River Data:', riverData);
  }, [forestLayout, flowData, riverData]);

  // Initialize Three.js scene
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current || accounts.length === 0) return;

    const canvas = canvasRef.current;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.Fog(0x0a1020, 20, 100);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 0.8);
    spotLight.position.set(10, 20, 10);
    scene.add(spotLight);

    const pointLight = new THREE.PointLight(0x00f5d4, 0.4);
    pointLight.position.set(-10, 10, -10);
    scene.add(pointLight);

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0e1a,
      transparent: true,
      opacity: 0.3,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    // Add financial trees
    forestLayout.forEach((layout, index) => {
      const account = accounts[index];
      if (!account) return;

      const treeData = buildTreeHierarchy(account, categories, transactions);
      const treeGroup = createTreeMesh(treeData, layout.position);
      scene.add(treeGroup);
    });

    // Handle resize
    const handleResize = () => {
      if (!canvas || !camera || !renderer) return;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Rotate camera slowly
      const radius = 20;
      camera.position.x = Math.sin(time * 0.0001) * radius;
      camera.position.z = Math.cos(time * 0.0001) * radius;
      camera.lookAt(0, 5, 0);

      renderer.render(scene, camera);
    };
    animate(0);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
    };
  }, [accounts, categories, transactions, forestLayout]);

  // Fallback for native platforms
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <DashboardHeader onBack={() => navigation.goBack()} />
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            FinBiome is available on web.{'\n'}
            Open finduo.app in your browser.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader onBack={() => navigation.goBack()} />

      <View style={styles.canvasContainer}>
        <canvas
          ref={canvasRef as any}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </View>

      {/* Data inspection overlay */}
      <ScrollView style={styles.debugOverlay}>
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>FinBiome Active</Text>
          <Text style={styles.debugText}>
            Accounts: {accounts.length}{'\n'}
            Categories: {categories.length}{'\n'}
            Transactions: {transactions.length}{'\n'}
            Using: Plain Three.js
          </Text>
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Forest Layout</Text>
          <Text style={styles.debugText}>
            {forestLayout.map((layout, i) => {
              const account = accounts[i];
              return `${account?.name || 'Account'}: [${layout.position
                .map((n) => n.toFixed(1))
                .join(', ')}]`;
            }).join('\n')}
          </Text>
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Controls</Text>
          <Text style={styles.debugText}>
            Camera: Auto-rotating{'\n'}
            View: Financial Forest{'\n'}
            Rendering: WebGL
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Helper function to create a tree mesh from tree data
function createTreeMesh(treeData: any, position: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);

  // Root: Account node (sphere)
  const rootSize = Math.max(0.4, Math.min(2.4, Math.log10(treeData.value + 1) * 0.3));
  const rootGeometry = new THREE.SphereGeometry(rootSize, 32, 32);
  const rootMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f5d4,
    emissive: 0x00f5d4,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.6,
  });
  const rootMesh = new THREE.Mesh(rootGeometry, rootMaterial);
  rootMesh.position.set(...treeData.position);
  group.add(rootMesh);

  // Branches: Category nodes (cubes)
  treeData.children.forEach((categoryNode: any) => {
    const categorySize = Math.max(
      0.3,
      Math.min(1.2, Math.log10(categoryNode.value + 1) * 0.2)
    );
    const categoryGeometry = new THREE.BoxGeometry(categorySize, categorySize, categorySize);
    const categoryMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(categoryNode.color || '#56cfe1'),
      emissive: new THREE.Color(categoryNode.color || '#56cfe1'),
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.4,
    });
    const categoryMesh = new THREE.Mesh(categoryGeometry, categoryMaterial);
    categoryMesh.position.set(...categoryNode.position);
    group.add(categoryMesh);

    // Edge from root to category
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00c9ff, opacity: 0.5, transparent: true });
    const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...treeData.position),
      new THREE.Vector3(...categoryNode.position),
    ]);
    const edge = new THREE.Line(edgeGeometry, edgeMaterial);
    group.add(edge);

    // Leaves: Transaction nodes (small spheres)
    categoryNode.children.forEach((transactionNode: any) => {
      const leafGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const leafMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(transactionNode.color),
        emissive: new THREE.Color(transactionNode.color),
        emissiveIntensity: 0.4,
        roughness: 0.5,
      });
      const leafMesh = new THREE.Mesh(leafGeometry, leafMaterial);
      leafMesh.position.set(...transactionNode.position);
      group.add(leafMesh);

      // Edge from category to transaction
      const leafEdgeGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...categoryNode.position),
        new THREE.Vector3(...transactionNode.position),
      ]);
      const leafEdge = new THREE.Line(leafEdgeGeometry, edgeMaterial);
      group.add(leafEdge);
    });
  });

  return group;
}

// Wrapper component with DashboardProvider
export default function FinBiomeScreen() {
  return (
    <DashboardProvider>
      <FinBiomeContent />
    </DashboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090F',
  },
  canvasContainer: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackText: {
    color: '#00F5D4',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'DM Sans',
  },
  debugOverlay: {
    position: 'absolute',
    top: 80,
    right: 10,
    width: 400,
    maxHeight: '80%',
    backgroundColor: 'rgba(10, 20, 40, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
    padding: 16,
  },
  debugSection: {
    marginBottom: 16,
  },
  debugTitle: {
    color: '#00F5D4',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'DM Sans',
  },
  debugText: {
    color: '#8FA8C9',
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
    lineHeight: 16,
  },
});
