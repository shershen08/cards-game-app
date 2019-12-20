<script>
  import { Router, Link, Route } from "svelte-routing";
  import Main from "./routes/index.svelte";
  import About from "./routes/about.svelte";
  import { navigate } from "svelte-routing";

  import TopAppBar, {Row, Section, Title} from '@smui/top-app-bar';
  import IconButton from '@smui/icon-button';

  export let url = "";

  let dense = false;
  let prominent = false;
  let variant = 'standard';
  let collapsed = false;
  let title = 'Cards game';

</script>

<Router url="{url}">

<TopAppBar {dense} {prominent} {variant}>
  <Row>
    <Section on:click={() => navigate("/")}>
      <Title>{title}</Title>
    </Section>
    <Section align="end" toolbar>
            <a href="https://twitter.com/share?" class="twitter-share-button"  data-text="Card memory game with #svelte" data-show-count="true">Tweet</a>
        <Link to="about"><IconButton class="material-icons" aria-label="Bookmark this page">info</IconButton></Link>
    </Section>
  </Row>
</TopAppBar>
  <div style="padding:70px 0 0 0;">
    <Route path="about" component="{About}" />
    <Route path="/"><Main /></Route>
  </div>
</Router>

