import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from '../Icon';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

const README_URL =
  'https://raw.githubusercontent.com/elarf/finduo/main/README.md';

const PATCHNOTES_URL =
  'https://raw.githubusercontent.com/elarf/finduo/main/PATCHNOTES.md';

type ChangelogModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ChangelogModal({ visible, onClose }: ChangelogModalProps) {
  const [view, setView] = useState<'patchnotes' | 'readme'>('patchnotes');
  const [content, setContent] = useState('');
  const [scrollY, setScrollY] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 1024;

  function sanitizeContent(text: string) {
    return text
      .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
      .replace(/^\s*---\s*$/gm, '')     // hr noise cleanup
      .trim();
  }

  useEffect(() => {
    const url = view === 'patchnotes' ? PATCHNOTES_URL : README_URL;

    fetch(url)
      .then((res) => res.text())
      .then((text) => setContent(sanitizeContent(text)))
      .catch(() => setContent('Failed to load content.'));
  }, [view]);

  function parseLines(content: string) {
    return content.split('\n').map((line) => {
      if (line.startsWith('## ')) return { type: 'h2', text: line.slice(3) };
      if (line.startsWith('### ')) return { type: 'h3', text: line.slice(4) };
      if (line.startsWith('#### ')) return { type: 'h4', text: line.slice(5) };
      if (line === '---') return { type: 'hr' };
      if (line.trim() === '') return { type: 'spacer' };

      const bullet = line.match(/^(\s+)- (.+)$/);
      if (bullet) return { type: 'bullet', text: bullet[2], indent: 2 };

      if (line.startsWith('- ')) return { type: 'bullet', text: line.slice(2), indent: 0 };

      return { type: 'body', text: line };
    });
  }

  function stripBold(text: string) {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1');
  }

  function renderNode(node: any, index: number) {
    switch (node.type) {
      case 'h2':
        return <Text key={index} style={cs.h2}>{node.text}</Text>;
      case 'h3':
        return <Text key={index} style={cs.h3}>{node.text}</Text>;
      case 'h4':
        return <Text key={index} style={cs.h4}>{node.text}</Text>;
      case 'bullet':
        return (
          <View key={index} style={cs.bulletRow}>
            <Text style={cs.bulletDot}>{node.indent ? '◦' : '•'}</Text>
            <Text style={cs.bulletText}>{stripBold(node.text)}</Text>
          </View>
        );
      case 'hr':
        return <View key={index} style={cs.hr} />;
      case 'spacer':
        return <View key={index} style={cs.spacer} />;
      case 'body':
        return <Text key={index} style={cs.body}>{stripBold(node.text)}</Text>;
    }
  }

  const nodes = parseLines(content);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[{ flex: 1 }, isWide && { alignItems: 'center', justifyContent: 'center' }]}>
        {isWide && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}

        <View style={[cs.card, isWide && { width: 520, maxHeight: '88%' }]}>
          
          {/* Header */}
          <View style={cs.header}>
            <Text style={cs.title}>
              {view === 'patchnotes' ? '📋 Patch Notes' : '📖 README'}
            </Text>

            <TouchableOpacity
              style={cs.toggleBtn}
              onPress={() =>
                setView(view === 'patchnotes' ? 'readme' : 'patchnotes')
              }
            >
              <Text style={cs.toggleBtnText}>
                {view === 'patchnotes' ? 'Show README' : 'Show Patch Notes'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={cs.scrollContent}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setScrollY(e.nativeEvent.contentOffset.y)
            }
            scrollEventThrottle={16}
          >
            {nodes.map(renderNode)}
          </ScrollView>

          {/* Footer */}
          <View style={cs.footer}>
            <TouchableOpacity style={cs.closeBtn} onPress={onClose}>
              <Text style={cs.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* FAB */}
          {scrollY > 200 && (
            <TouchableOpacity
              style={cs.fab}
              onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            >
              <Icon name="arrow_up" size={20} color="#060A14" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#060A14' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2F49',
  },
  title: { color: '#EDF5FF', fontSize: 17, fontWeight: '700' },
  toggleBtn: {
    backgroundColor: '#13253B',
    padding: 6,
    borderRadius: 8,
  },
  toggleBtnText: { color: '#8FA8C9', fontSize: 13 },
  scrollContent: { padding: 20 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1E2F49' },
  closeBtn: {
    backgroundColor: '#13253B',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtnText: { color: '#8FA8C9' },

  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#53E3A6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  h2: { color: '#53E3A6', marginTop: 8 },
  h3: { color: '#EDF5FF', marginTop: 6 },
  h4: { color: '#8FA8C9' },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bulletDot: { color: '#53E3A6' },
  bulletText: { color: '#94A3B8' },
  hr: { height: 1, backgroundColor: '#1E2F49', marginVertical: 10 },
  spacer: { height: 4 },
  body: { color: '#64748B' },
});