import React from 'react';
import { readDatarefValue } from '../utils/dataref';

type Props = {
  name?: string;
  index?: number;
  tick: number;
};

const DatarefValue: React.FC<Props> = ({ name, index, tick }) => {
  if (!name) return <span className="ValueCell">—</span>;
  void tick;
  return <span className="ValueCell">{readDatarefValue(name, index)}</span>;
};

export default DatarefValue;
