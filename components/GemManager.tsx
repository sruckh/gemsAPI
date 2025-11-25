import React, { useState } from 'react';
import { Gem, AppConfig } from '../types';
import { createGem, updateGem, deleteGem } from '../services/dbService';
import { Plus, Edit2, Trash2, Bot, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import TextArea from './TextArea';
import Modal from './Modal';

interface GemManagerProps {
  gems: Gem[];
  config: AppConfig;
  onRefresh: () => void;
}

// Sub-component for cell text that expands on click
const ExpandableText: React.FC<{ text: string }> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded transition-colors ${
        isExpanded ? 'max-h-60 overflow-y-auto custom-scrollbar' : 'line-clamp-3'
      }`}
      title={isExpanded ? "Click to collapse" : "Click to expand"}
    >
      {text || <span className="text-gray-400 dark:text-gray-500 italic">No content</span>}
    </div>
  );
};

const GemManager: React.FC<GemManagerProps> = ({ gems, config, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGem, setEditingGem] = useState<Gem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleOpenCreate = () => {
    setEditingGem(null);
    setName('');
    setDescription('');
    setInstructions('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (gem: Gem) => {
    setEditingGem(gem);
    setName(gem.name);
    setDescription(gem.description);
    setInstructions(gem.instructions);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingGem) {
        await updateGem({ ...editingGem, name, description, instructions }, config);
      } else {
        await createGem({ name, description, instructions }, config);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save Gem');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Gem?')) return;
    try {
      await deleteGem(id, config);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete Gem');
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(gems.length / ITEMS_PER_PAGE);
  const paginatedGems = gems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
      
      {/* Header Toolbar */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-xl font-medium text-gray-800 dark:text-gray-100">Database Manager</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and edit your Gems collection</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus size={18} className="mr-2" />
          New Gem
        </Button>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 relative">
        {gems.length === 0 ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
             <Bot size={48} className="mb-4 opacity-20" />
             <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No Gems found</p>
             <p className="text-sm">Create a new Gem to populate the database.</p>
           </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]">Name</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[25%]">Description</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">Instructions</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Date</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedGems.map((gem) => (
                <tr key={gem.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                  <td className="p-4 align-top">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        {gem.name.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{gem.name}</span>
                    </div>
                  </td>
                  <td className="p-4 align-top">
                    <ExpandableText text={gem.description} />
                  </td>
                  <td className="p-4 align-top">
                    <ExpandableText text={gem.instructions} />
                  </td>
                  <td className="p-4 align-top text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(gem.created_at || '').toLocaleDateString()}
                  </td>
                  <td className="p-4 align-top text-right">
                    <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenEdit(gem)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(gem.id)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Toolbar */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Showing <span className="font-medium">{Math.min(gems.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to <span className="font-medium">{Math.min(gems.length, currentPage * ITEMS_PER_PAGE)}</span> of <span className="font-medium">{gems.length}</span> results
        </div>
        <div className="flex items-center gap-2">
           <button
             onClick={() => handlePageChange(currentPage - 1)}
             disabled={currentPage === 1}
             className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-400"
           >
             <ChevronLeft size={18} />
           </button>
           <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
             Page {currentPage} of {Math.max(1, totalPages)}
           </span>
           <button
             onClick={() => handlePageChange(currentPage + 1)}
             disabled={currentPage === totalPages || totalPages === 0}
             className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-400"
           >
             <ChevronRight size={18} />
           </button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGem ? 'Edit Gem Configuration' : 'Create New Gem'}
      >
        <form onSubmit={handleSave} className="flex flex-col h-full">
          <Input 
            label="Gem Name" 
            placeholder="e.g. Python Expert, Storyteller" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />
          <Input 
            label="Description" 
            placeholder="Short description for the table view" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
          />
          <TextArea 
            label="System Instructions" 
            placeholder="Detailed instructions for the AI behavior..." 
            value={instructions} 
            onChange={e => setInstructions(e.target.value)} 
            required
            className="h-48 font-mono text-sm bg-gray-50 dark:bg-gray-700/50"
          />
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingGem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GemManager;