import { Header } from '@/components/ui';
import FixtureEditor from '@/components/FixtureEditor';
import { officialSheets } from '@/data/official';

export default function AdminFixtures() {
  return (
    <>
      <Header title="Fixture Editor ✏️" sub="Change players, reorder fixtures, add or delete matches, rounds and categories." />
      <FixtureEditor sports={officialSheets.map(sheet => sheet.sport)} />
    </>
  );
}
